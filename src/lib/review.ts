import "server-only";
import { prisma } from "@/lib/prisma";

// Surfaces gaps and inconsistencies in the profile's data that need a manual
// decision — the "à vérifier" queue. Everything here is derived from the
// existing records; fixing an item means editing the linked record.

export type ReviewSeverity = "error" | "warning" | "info";

export type ReviewItem = {
  id: string;
  severity: ReviewSeverity;
  title: string;
  detail: string;
  href: string | null;
  hrefLabel: string | null;
};

function txSignature(tx: {
  executedAt: Date;
  assetId: string;
  type: string;
  quantity: { toNumber(): number };
  amountInvested: { toNumber(): number };
}): string {
  const day = tx.executedAt.toISOString().slice(0, 10);
  const qty = Math.round(tx.quantity.toNumber() * 1e8) / 1e8;
  const amount = Math.round(tx.amountInvested.toNumber() * 100) / 100;
  return `${day}|${tx.assetId}|${tx.type}|${qty}|${amount}`;
}

export async function loadReviewItems(
  profileId: string,
): Promise<ReviewItem[]> {
  const [transactions, assets, wallets] = await Promise.all([
    prisma.transaction.findMany({
      where: { wallet: { profileId } },
      orderBy: { executedAt: "asc" },
      include: {
        wallet: { select: { id: true, name: true, type: true } },
        asset: { select: { id: true, name: true, symbol: true, type: true } },
      },
    }),
    prisma.asset.findMany({ where: { profileId } }),
    prisma.wallet.findMany({ where: { profileId } }),
  ]);

  const items: ReviewItem[] = [];

  // --- Oversell: a position sells more than it ever held ----------------
  const positions = new Map<string, typeof transactions>();
  for (const tx of transactions) {
    const key = `${tx.walletId}::${tx.assetId}`;
    const list = positions.get(key);
    if (list) list.push(tx);
    else positions.set(key, [tx]);
  }
  for (const positionTxs of positions.values()) {
    let held = 0;
    for (const tx of positionTxs) {
      const quantity = tx.quantity.toNumber();
      if (tx.type === "SELL") {
        if (quantity > held + 1e-8) {
          items.push({
            id: `oversell-${tx.id}`,
            severity: "error",
            title: `Vente sans achat — ${tx.asset.name}`,
            detail: `La quantité vendue (${quantity}) dépasse la quantité détenue dans « ${tx.wallet.name} ». Il manque probablement un achat, ou la quantité est erronée.`,
            href: `/transactions/${tx.id}`,
            hrefLabel: "Corriger la vente",
          });
          break; // one item per position is enough
        }
        held = Math.max(0, held - quantity);
      } else {
        held += quantity;
      }
    }
  }

  // --- Buys with no cost basis -----------------------------------------
  for (const tx of transactions) {
    if (tx.type === "BUY" && tx.amountInvested.toNumber() <= 0) {
      items.push({
        id: `nocost-${tx.id}`,
        severity: "error",
        title: `Achat sans montant — ${tx.asset.name}`,
        detail: `Cet achat du ${tx.executedAt.toISOString().slice(0, 10)} a un montant investi de 0. Le prix de revient est inconnu, ce qui fausse les plus-values.`,
        href: `/transactions/${tx.id}`,
        hrefLabel: "Renseigner le montant",
      });
    }
  }

  // --- Duplicate transactions already in the database ------------------
  const seen = new Map<string, string>(); // signature -> first tx id
  for (const tx of transactions) {
    const signature = txSignature(tx);
    const firstId = seen.get(signature);
    if (firstId === undefined) {
      seen.set(signature, tx.id);
    } else {
      items.push({
        id: `dup-${tx.id}`,
        severity: "warning",
        title: `Doublon possible — ${tx.asset.name}`,
        detail: `Une transaction identique (même date, type, quantité et montant) existe déjà. Supprimez-en une si c'est bien un doublon.`,
        href: `/transactions/${tx.id}`,
        hrefLabel: "Vérifier la transaction",
      });
    }
  }

  // --- Assets with no live-price provider ------------------------------
  for (const asset of assets) {
    if (!asset.coingeckoId && !asset.yahooSymbol) {
      items.push({
        id: `noprice-${asset.id}`,
        severity: "warning",
        title: `Prix en direct manquant — ${asset.name}`,
        detail: `Aucun identifiant CoinGecko ou Yahoo Finance n'est renseigné : la valeur de cet asset reste figée à son coût d'achat.`,
        href: `/assets/${asset.id}`,
        hrefLabel: "Renseigner l'identifiant",
      });
    }
  }

  // --- PEA without an opening date -------------------------------------
  for (const wallet of wallets) {
    if (wallet.type === "PEA" && wallet.openedAt === null) {
      items.push({
        id: `peadate-${wallet.id}`,
        severity: "warning",
        title: `Date d'ouverture du PEA manquante — ${wallet.name}`,
        detail: `Sans date d'ouverture, la règle des 5 ans ne peut pas s'appliquer automatiquement au calcul d'impôt.`,
        href: `/wallets/${wallet.id}`,
        hrefLabel: "Renseigner la date",
      });
    }
  }

  // --- Crypto sells not flagged as swaps -------------------------------
  const cryptoSells = transactions.filter(
    (tx) => tx.type === "SELL" && tx.asset.type === "CRYPTO" && !tx.taxExempt,
  );
  if (cryptoSells.length > 0) {
    items.push({
      id: "crypto-sells-review",
      severity: "info",
      title: `${cryptoSells.length} vente${
        cryptoSells.length === 1 ? "" : "s"
      } crypto à vérifier`,
      detail:
        "Une conversion crypto↔crypto n'est pas imposable en France, contrairement à une sortie en euros. Marquez « vente non imposable » les conversions concernées.",
      href: "/transactions",
      hrefLabel: "Voir les transactions",
    });
  }

  // Errors first, then warnings, then info.
  const order: Record<ReviewSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };
  items.sort((a, b) => order[a.severity] - order[b.severity]);

  return items;
}

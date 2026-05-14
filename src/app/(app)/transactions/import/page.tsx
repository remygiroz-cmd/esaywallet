import Link from "next/link";
import { requireUser } from "@/lib/auth-server";
import { getUserWallets } from "@/lib/wallets";
import { getUserAssets } from "@/lib/assets";
import { getUserRealizedGainEntries } from "@/lib/realized-gains";
import { ui } from "@/lib/ui";
import { MultiImport } from "@/components/multi-import";
import { CmcImport } from "@/components/cmc-import";
import { TrImport } from "@/components/tr-import";
import { TransactionImport } from "@/components/transaction-import";
import { RealizedGainImport } from "@/components/realized-gain-import";

export default async function TransactionImportPage() {
  const user = await requireUser();
  const [wallets, assets, realizedEntries] = await Promise.all([
    getUserWallets(user.id),
    getUserAssets(user.id),
    getUserRealizedGainEntries(user.id),
  ]);

  const walletOptions = wallets.map((w) => ({
    id: w.id,
    name: w.name,
    currency: w.currency,
    type: w.type,
  }));

  const realizedRows = realizedEntries.map((entry) => ({
    id: entry.id,
    year: entry.year,
    securityName: entry.securityName,
    securityCode: entry.securityCode,
    realizedGain: entry.realizedGain.toNumber(),
    proceeds: entry.proceeds.toNumber(),
    source: entry.source,
    walletName: entry.wallet?.name ?? null,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/transactions"
          className="text-sm text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
        >
          ← Toutes les transactions
        </Link>
        <h1 className={`mt-2 ${ui.heading}`}>Import en masse</h1>
        <p className={`mt-1 ${ui.subtle}`}>
          Importez d&apos;un coup tout votre historique de transactions.
        </p>
      </div>

      {wallets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Créez d&apos;abord un wallet sur la page{" "}
          <Link
            href="/wallets"
            className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Wallets
          </Link>
          .
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Import universel — un ou plusieurs fichiers
            </h2>
            <p className={ui.subtle}>
              Déposez un ou plusieurs fichiers `.csv` exportés de n&apos;importe
              quel courtier ou tableur. easyWallet devine à quoi correspond
              chaque colonne (vérifiez et corrigez si besoin), fusionne tous
              les fichiers, détecte et exclut les transactions en double, puis
              vous laisse choisir le wallet de chaque asset avant l&apos;import.
            </p>
            <MultiImport wallets={walletOptions} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Relevé de plus-values (CTO)
            </h2>
            <p className={ui.subtle}>
              Pour un compte-titres, votre banque fournit déjà le récapitulatif
              fiscal annuel avec la +/- value réalisée par titre. Importez-le
              directement : ces chiffres font foi et alimentent la page
              Fiscalité sans avoir à reconstituer chaque achat/vente.
            </p>
            <RealizedGainImport
              wallets={walletOptions}
              entries={realizedRows}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Raccourci CoinMarketCap
            </h2>
            <p className={ui.subtle}>
              Pré-configuré pour le fichier d&apos;export CoinMarketCap : tous
              les assets sont des cryptos.
            </p>
            <CmcImport wallets={walletOptions} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Raccourci Trade Republic
            </h2>
            <p className={ui.subtle}>
              Pré-configuré pour le fichier d&apos;export Trade Republic : les
              titres sont identifiés par leur code ISIN.
            </p>
            <TrImport wallets={walletOptions} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Coller des lignes (un seul asset)
            </h2>
            <p className={ui.subtle}>
              Pour un import rapide d&apos;un seul asset : choisissez le wallet
              et l&apos;asset, puis collez les colonnes Date, Montant investi,
              Quantité, Prix unitaire.
            </p>
            <TransactionImport
              wallets={walletOptions}
              assets={assets.map((a) => ({
                id: a.id,
                name: a.name,
                symbol: a.symbol,
              }))}
            />
          </section>
        </>
      )}
    </div>
  );
}

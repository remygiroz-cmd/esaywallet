import "server-only";
import { prisma } from "@/lib/prisma";
import { getCashByWallet } from "@/lib/cash";
import { walletTracksCash } from "@/lib/constants";
import {
  computePortfolio,
  type PortfolioInput,
  type PortfolioComputation,
} from "@/lib/portfolio";

// Gathers every input the computation engine needs and converts Prisma
// Decimal values to plain numbers so the result is JSON-serialisable.
export async function loadPortfolioInput(
  profileId: string,
): Promise<PortfolioInput> {
  const [
    wallets,
    assets,
    transactions,
    prices,
    fxRates,
    cashByWallet,
    cashMovements,
  ] = await Promise.all([
    prisma.wallet.findMany({ where: { profileId } }),
    prisma.asset.findMany({ where: { profileId } }),
    prisma.transaction.findMany({ where: { wallet: { profileId } } }),
    prisma.priceCache.findMany({ where: { asset: { profileId } } }),
    prisma.fxRate.findMany({ where: { base: "EUR" } }),
    getCashByWallet(profileId),
    prisma.cashMovement.findMany({
      where: { wallet: { profileId } },
      select: { walletId: true, kind: true, amount: true },
    }),
  ]);

  // Net contributions (versements) derived from movements: deposits − withdrawals.
  const derivedDeposits = new Map<string, number>();
  for (const movement of cashMovements) {
    const amount = movement.amount.toNumber();
    const signed = movement.kind === "DEPOSIT" ? amount : -amount;
    derivedDeposits.set(
      movement.walletId,
      (derivedDeposits.get(movement.walletId) ?? 0) + signed,
    );
  }

  // Resolve the final cash (espèces) and deposits (versements) per wallet,
  // applying the per-wallet manual overrides when set:
  //  - A CTO (and any non-cash wallet type) carries no cash at all — its
  //    value is just the holdings, with realised gains and tax tracked
  //    separately. So its cash is forced to 0.
  //  - Otherwise, a manual override replaces the computed figure; a null
  //    override falls back to the value derived from movements/transactions.
  const finalCashByWallet = new Map<string, number>();
  const depositsByWallet = new Map<string, number>();
  for (const wallet of wallets) {
    const manualCash = wallet.manualCash;
    const manualDeposits = wallet.manualDeposits;

    if (!walletTracksCash(wallet.type)) {
      finalCashByWallet.set(wallet.id, 0);
    } else {
      finalCashByWallet.set(
        wallet.id,
        manualCash !== null
          ? manualCash.toNumber()
          : (cashByWallet.get(wallet.id) ?? 0),
      );
    }

    depositsByWallet.set(
      wallet.id,
      manualDeposits !== null
        ? manualDeposits.toNumber()
        : (derivedDeposits.get(wallet.id) ?? 0),
    );
  }

  return {
    wallets: wallets.map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      type: wallet.type,
      currency: wallet.currency,
      taxRate: wallet.taxRate,
      openedAt: wallet.openedAt?.toISOString() ?? null,
    })),
    assets: assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      symbol: asset.symbol,
      type: asset.type,
      quoteCurrency: asset.quoteCurrency,
    })),
    transactions: transactions.map((tx) => ({
      id: tx.id,
      walletId: tx.walletId,
      assetId: tx.assetId,
      type: tx.type,
      executedAt: tx.executedAt.toISOString(),
      unitPrice: tx.unitPrice.toNumber(),
      quantity: tx.quantity.toNumber(),
      amountInvested: tx.amountInvested.toNumber(),
      fees: tx.fees.toNumber(),
      taxExempt: tx.taxExempt,
    })),
    prices: prices.map((price) => ({
      assetId: price.assetId,
      price: price.price.toNumber(),
      currency: price.currency,
      change24h: price.change24h,
      fetchedAt: price.fetchedAt.toISOString(),
    })),
    fxRates: fxRates.map((rate) => ({
      quote: rate.quote,
      rate: rate.rate.toNumber(),
    })),
    cashByWallet: Object.fromEntries(finalCashByWallet),
    depositsByWallet: Object.fromEntries(depositsByWallet),
  };
}

export async function loadPortfolio(
  profileId: string,
): Promise<PortfolioComputation> {
  return computePortfolio(await loadPortfolioInput(profileId));
}

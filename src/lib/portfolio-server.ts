import "server-only";
import { prisma } from "@/lib/prisma";
import { getCashByWallet } from "@/lib/cash";
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

  // Fold the user-entered manual liquidity into the per-wallet cash so the
  // wallet total picks it up alongside the movements-derived cash.
  const cashByWalletWithManual = new Map(cashByWallet);
  for (const wallet of wallets) {
    const manual = wallet.manualLiquidity.toNumber();
    if (manual !== 0) {
      cashByWalletWithManual.set(
        wallet.id,
        (cashByWalletWithManual.get(wallet.id) ?? 0) + manual,
      );
    }
  }

  // Net contributions per wallet: deposits − withdrawals, plus the manual
  // liquidity (treated as recorded versement so the global gain compares
  // current value against everything the user has put in).
  const depositsByWallet = new Map<string, number>();
  for (const movement of cashMovements) {
    const amount = movement.amount.toNumber();
    const signed = movement.kind === "DEPOSIT" ? amount : -amount;
    depositsByWallet.set(
      movement.walletId,
      (depositsByWallet.get(movement.walletId) ?? 0) + signed,
    );
  }
  for (const wallet of wallets) {
    const manual = wallet.manualLiquidity.toNumber();
    if (manual !== 0) {
      depositsByWallet.set(
        wallet.id,
        (depositsByWallet.get(wallet.id) ?? 0) + manual,
      );
    }
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
    cashByWallet: Object.fromEntries(cashByWalletWithManual),
    depositsByWallet: Object.fromEntries(depositsByWallet),
  };
}

export async function loadPortfolio(
  profileId: string,
): Promise<PortfolioComputation> {
  return computePortfolio(await loadPortfolioInput(profileId));
}

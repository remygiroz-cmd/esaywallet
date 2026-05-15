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
  const [wallets, assets, transactions, prices, fxRates, cashByWallet] =
    await Promise.all([
      prisma.wallet.findMany({ where: { profileId } }),
      prisma.asset.findMany({ where: { profileId } }),
      prisma.transaction.findMany({ where: { wallet: { profileId } } }),
      prisma.priceCache.findMany({ where: { asset: { profileId } } }),
      prisma.fxRate.findMany({ where: { base: "EUR" } }),
      getCashByWallet(profileId),
    ]);

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
    cashByWallet: Object.fromEntries(cashByWallet),
  };
}

export async function loadPortfolio(
  profileId: string,
): Promise<PortfolioComputation> {
  return computePortfolio(await loadPortfolioInput(profileId));
}

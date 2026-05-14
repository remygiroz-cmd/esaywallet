import "server-only";
import { prisma } from "@/lib/prisma";
import {
  computePortfolio,
  type PortfolioInput,
  type PortfolioComputation,
} from "@/lib/portfolio";

// Gathers every input the computation engine needs and converts Prisma
// Decimal values to plain numbers so the result is JSON-serialisable.
export async function loadPortfolioInput(
  userId: string,
): Promise<PortfolioInput> {
  const [wallets, assets, transactions, prices, fxRates] = await Promise.all([
    prisma.wallet.findMany({ where: { userId } }),
    prisma.asset.findMany({ where: { userId } }),
    prisma.transaction.findMany({ where: { wallet: { userId } } }),
    prisma.priceCache.findMany({ where: { asset: { userId } } }),
    prisma.fxRate.findMany({ where: { base: "EUR" } }),
  ]);

  return {
    wallets: wallets.map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      type: wallet.type,
      currency: wallet.currency,
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
    })),
    prices: prices.map((price) => ({
      assetId: price.assetId,
      price: price.price.toNumber(),
      currency: price.currency,
      fetchedAt: price.fetchedAt.toISOString(),
    })),
    fxRates: fxRates.map((rate) => ({
      quote: rate.quote,
      rate: rate.rate.toNumber(),
    })),
  };
}

export async function loadPortfolio(
  userId: string,
): Promise<PortfolioComputation> {
  return computePortfolio(await loadPortfolioInput(userId));
}

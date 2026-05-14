import "server-only";
import { prisma } from "@/lib/prisma";
import { SUPPORTED_CURRENCIES } from "@/lib/constants";
import { fetchCryptoPrices } from "./coingecko";
import { fetchStockPrice } from "./yahoo";
import { fetchFxRates } from "./fx";

// A price younger than this is considered fresh and is not refetched —
// keeps us within the free rate limits of the upstream APIs.
const PRICE_TTL_MS = 55_000;
// FX reference rates barely move intraday, so refresh them at most hourly.
const FX_TTL_MS = 60 * 60 * 1000;
const FX_BASE = "EUR";

export type PriceRefreshResult = {
  refreshedAt: string;
  updated: number;
  errors: string[];
};

function isStale(price: { fetchedAt: Date } | null, now: number): boolean {
  return !price || now - price.fetchedAt.getTime() > PRICE_TTL_MS;
}

export async function refreshPrices(
  userId: string,
): Promise<PriceRefreshResult> {
  const now = Date.now();
  const errors: string[] = [];
  let updated = 0;

  const assets = await prisma.asset.findMany({
    where: { userId },
    include: { price: true },
  });

  // --- Crypto: a single batched CoinGecko request ---
  const cryptoAssets = assets.filter(
    (asset) =>
      asset.type === "CRYPTO" &&
      asset.coingeckoId &&
      isStale(asset.price, now),
  );
  if (cryptoAssets.length > 0) {
    const ids = [
      ...new Set(cryptoAssets.map((asset) => asset.coingeckoId as string)),
    ];
    try {
      const priceMap = await fetchCryptoPrices(ids, [...SUPPORTED_CURRENCIES]);
      for (const asset of cryptoAssets) {
        const value = priceMap.get(asset.coingeckoId as string)?.[
          asset.quoteCurrency
        ];
        if (typeof value === "number") {
          await savePrice(asset.id, value, asset.quoteCurrency);
          updated += 1;
        } else {
          errors.push(
            `Prix introuvable pour ${asset.symbol} (CoinGecko : ${asset.coingeckoId}).`,
          );
        }
      }
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "Erreur CoinGecko.",
      );
    }
  }

  // --- Stocks & ETFs: one Yahoo Finance request per symbol ---
  const stockAssets = assets.filter(
    (asset) =>
      asset.type !== "CRYPTO" &&
      asset.yahooSymbol &&
      isStale(asset.price, now),
  );
  for (const asset of stockAssets) {
    try {
      const quote = await fetchStockPrice(asset.yahooSymbol as string);
      if (quote) {
        await savePrice(asset.id, quote.price, quote.currency);
        updated += 1;
      } else {
        errors.push(
          `Prix introuvable pour ${asset.symbol} (Yahoo : ${asset.yahooSymbol}).`,
        );
      }
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : `Erreur Yahoo Finance (${asset.symbol}).`,
      );
    }
  }

  await refreshFxRates(now, errors);

  return {
    refreshedAt: new Date().toISOString(),
    updated,
    errors,
  };
}

async function savePrice(
  assetId: string,
  price: number,
  currency: string,
): Promise<void> {
  await prisma.priceCache.upsert({
    where: { assetId },
    create: { assetId, price, currency },
    update: { price, currency, fetchedAt: new Date() },
  });
}

async function refreshFxRates(now: number, errors: string[]): Promise<void> {
  const targets = SUPPORTED_CURRENCIES.filter(
    (currency) => currency !== FX_BASE,
  );
  const existing = await prisma.fxRate.findMany({ where: { base: FX_BASE } });
  const freshEnough =
    existing.length === targets.length &&
    existing.every((rate) => now - rate.fetchedAt.getTime() < FX_TTL_MS);
  if (freshEnough) return;

  try {
    const rates = await fetchFxRates(FX_BASE, [...targets]);
    for (const [quote, rate] of Object.entries(rates)) {
      await prisma.fxRate.upsert({
        where: { base_quote: { base: FX_BASE, quote } },
        create: { base: FX_BASE, quote, rate },
        update: { rate, fetchedAt: new Date() },
      });
    }
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "Erreur taux de change.",
    );
  }
}

// Read-only cache accessors consumed by the dashboard.
export function getCachedPrices(userId: string) {
  return prisma.priceCache.findMany({ where: { asset: { userId } } });
}

export function getCachedFxRates() {
  return prisma.fxRate.findMany({ where: { base: FX_BASE } });
}

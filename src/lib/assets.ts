import "server-only";
import { prisma } from "@/lib/prisma";
import type { AssetType } from "@/lib/constants";

export type AssetInput = {
  symbol: string;
  name: string;
  type: AssetType;
  quoteCurrency: string;
  coingeckoId?: string | null;
  yahooSymbol?: string | null;
};

export function getProfileAssets(profileId: string) {
  return prisma.asset.findMany({
    where: { profileId },
    orderBy: { name: "asc" },
    include: {
      price: true,
      _count: { select: { transactions: true } },
    },
  });
}

export function getAsset(id: string, profileId: string) {
  return prisma.asset.findFirst({
    where: { id, profileId },
    include: {
      price: true,
      _count: { select: { transactions: true } },
    },
  });
}

// Create the asset, or reuse an existing one with the same symbol+type.
export async function upsertAsset(profileId: string, data: AssetInput) {
  const existing = await prisma.asset.findUnique({
    where: {
      profileId_symbol_type: {
        profileId,
        symbol: data.symbol,
        type: data.type,
      },
    },
  });
  if (existing) {
    // Backfill a missing price identifier if the new data provides one,
    // but never overwrite an identifier the user already set.
    const coingeckoId = existing.coingeckoId ?? data.coingeckoId ?? null;
    const yahooSymbol = existing.yahooSymbol ?? data.yahooSymbol ?? null;
    if (
      coingeckoId !== existing.coingeckoId ||
      yahooSymbol !== existing.yahooSymbol
    ) {
      return prisma.asset.update({
        where: { id: existing.id },
        data: { coingeckoId, yahooSymbol },
      });
    }
    return existing;
  }
  return prisma.asset.create({ data: { ...data, profileId } });
}

export function updateAsset(id: string, profileId: string, data: AssetInput) {
  return prisma.asset.updateMany({ where: { id, profileId }, data });
}

export function deleteAsset(id: string, profileId: string) {
  return prisma.asset.deleteMany({ where: { id, profileId } });
}

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
      _count: {
        select: { transactions: true, income: true, priceAlerts: true },
      },
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

// Re-attach every transaction, income entry and price alert pointing at one
// of `sourceIds` to `targetId`, then delete the source assets. Used to merge
// duplicates that were created involuntarily (e.g. when recording a transaction
// with a slightly different symbol). All operations run in a single Prisma
// transaction so a partial merge can never leave dangling references.
export async function mergeAssets(
  profileId: string,
  targetId: string,
  sourceIds: string[],
) {
  return prisma.$transaction(async (tx) => {
    const reassign = { assetId: targetId };
    await tx.transaction.updateMany({
      where: { assetId: { in: sourceIds } },
      data: reassign,
    });
    await tx.income.updateMany({
      where: { assetId: { in: sourceIds } },
      data: reassign,
    });
    await tx.priceAlert.updateMany({
      where: { assetId: { in: sourceIds } },
      data: reassign,
    });
    await tx.asset.deleteMany({
      where: { id: { in: sourceIds }, profileId },
    });
  });
}

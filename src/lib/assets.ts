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

export function getUserAssets(userId: string) {
  return prisma.asset.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: {
      price: true,
      _count: { select: { transactions: true } },
    },
  });
}

export function getAsset(id: string, userId: string) {
  return prisma.asset.findFirst({
    where: { id, userId },
    include: {
      price: true,
      _count: { select: { transactions: true } },
    },
  });
}

// Create the asset, or reuse an existing one with the same symbol+type.
export async function upsertAsset(userId: string, data: AssetInput) {
  const existing = await prisma.asset.findUnique({
    where: {
      userId_symbol_type: { userId, symbol: data.symbol, type: data.type },
    },
  });
  if (existing) return existing;
  return prisma.asset.create({ data: { ...data, userId } });
}

export function updateAsset(id: string, userId: string, data: AssetInput) {
  return prisma.asset.updateMany({ where: { id, userId }, data });
}

export function deleteAsset(id: string, userId: string) {
  return prisma.asset.deleteMany({ where: { id, userId } });
}

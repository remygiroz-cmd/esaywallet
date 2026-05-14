import "server-only";
import { prisma } from "@/lib/prisma";
import type { WalletType } from "@/lib/constants";

export type WalletInput = {
  name: string;
  type: WalletType;
  currency: string;
};

export function getUserWallets(userId: string) {
  return prisma.wallet.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { transactions: true } } },
  });
}

export function getWallet(id: string, userId: string) {
  return prisma.wallet.findFirst({ where: { id, userId } });
}

export function createWallet(userId: string, data: WalletInput) {
  return prisma.wallet.create({ data: { ...data, userId } });
}

// Scoped by userId so a user can never mutate another user's wallet.
export function updateWallet(id: string, userId: string, data: WalletInput) {
  return prisma.wallet.updateMany({ where: { id, userId }, data });
}

export function deleteWallet(id: string, userId: string) {
  return prisma.wallet.deleteMany({ where: { id, userId } });
}

import "server-only";
import { prisma } from "@/lib/prisma";
import type { WalletType } from "@/lib/constants";

export type WalletInput = {
  name: string;
  type: WalletType;
  currency: string;
  taxRate: number | null;
  openedAt: Date | null;
  manualLiquidity: number;
};

export function getProfileWallets(profileId: string) {
  return prisma.wallet.findMany({
    where: { profileId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { transactions: true } } },
  });
}

export function getWallet(id: string, profileId: string) {
  return prisma.wallet.findFirst({ where: { id, profileId } });
}

export function createWallet(profileId: string, data: WalletInput) {
  return prisma.wallet.create({ data: { ...data, profileId } });
}

// Scoped by profileId so a profile can never mutate another's wallet.
export function updateWallet(id: string, profileId: string, data: WalletInput) {
  return prisma.wallet.updateMany({ where: { id, profileId }, data });
}

export function deleteWallet(id: string, profileId: string) {
  return prisma.wallet.deleteMany({ where: { id, profileId } });
}

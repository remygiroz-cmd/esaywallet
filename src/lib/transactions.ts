import "server-only";
import { prisma } from "@/lib/prisma";
import type { TransactionType } from "@/lib/constants";

export type TransactionInput = {
  walletId: string;
  assetId: string;
  type: TransactionType;
  executedAt: Date;
  unitPrice: number;
  quantity: number;
  amountInvested: number;
  fees: number;
  notes: string | null;
};

const txInclude = {
  wallet: {
    select: { id: true, name: true, type: true, currency: true },
  },
  asset: {
    select: {
      id: true,
      name: true,
      symbol: true,
      type: true,
      quoteCurrency: true,
    },
  },
} as const;

export function getUserTransactions(userId: string) {
  return prisma.transaction.findMany({
    where: { wallet: { userId } },
    orderBy: { executedAt: "desc" },
    include: txInclude,
  });
}

export function getWalletTransactions(walletId: string, userId: string) {
  return prisma.transaction.findMany({
    where: { walletId, wallet: { userId } },
    orderBy: { executedAt: "desc" },
    include: txInclude,
  });
}

export function getTransaction(id: string, userId: string) {
  return prisma.transaction.findFirst({
    where: { id, wallet: { userId } },
    include: txInclude,
  });
}

// Confirms the wallet and asset both belong to the user before linking them.
async function assertOwnership(
  userId: string,
  walletId: string,
  assetId: string,
): Promise<boolean> {
  const [wallet, asset] = await Promise.all([
    prisma.wallet.findFirst({ where: { id: walletId, userId } }),
    prisma.asset.findFirst({ where: { id: assetId, userId } }),
  ]);
  return Boolean(wallet && asset);
}

export async function createTransaction(
  userId: string,
  data: TransactionInput,
) {
  if (!(await assertOwnership(userId, data.walletId, data.assetId))) {
    return null;
  }
  return prisma.transaction.create({ data });
}

export async function updateTransaction(
  id: string,
  userId: string,
  data: TransactionInput,
) {
  const existing = await prisma.transaction.findFirst({
    where: { id, wallet: { userId } },
  });
  if (!existing) return null;
  if (!(await assertOwnership(userId, data.walletId, data.assetId))) {
    return null;
  }
  return prisma.transaction.update({ where: { id }, data });
}

export function deleteTransaction(id: string, userId: string) {
  return prisma.transaction.deleteMany({ where: { id, wallet: { userId } } });
}

export type BulkTransactionRow = {
  type: TransactionType;
  executedAt: Date;
  unitPrice: number;
  quantity: number;
  amountInvested: number;
  fees: number;
};

// Inserts many transactions at once into a single wallet/asset pair.
// Returns the inserted count, or null if the wallet or asset isn't the
// user's.
export async function createTransactionsBulk(
  userId: string,
  walletId: string,
  assetId: string,
  rows: BulkTransactionRow[],
): Promise<number | null> {
  if (!(await assertOwnership(userId, walletId, assetId))) {
    return null;
  }
  const result = await prisma.transaction.createMany({
    data: rows.map((row) => ({ ...row, walletId, assetId })),
  });
  return result.count;
}

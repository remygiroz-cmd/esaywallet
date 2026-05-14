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
  taxExempt: boolean;
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

// Moves every transaction of an asset from one wallet to another (i.e.
// reassigns the asset's whole position). Scoped to the user's own data.
export async function moveAssetTransactions(
  userId: string,
  assetId: string,
  fromWalletId: string,
  toWalletId: string,
): Promise<boolean> {
  if (fromWalletId === toWalletId) return false;

  const [fromWallet, toWallet, asset] = await Promise.all([
    prisma.wallet.findFirst({ where: { id: fromWalletId, userId } }),
    prisma.wallet.findFirst({ where: { id: toWalletId, userId } }),
    prisma.asset.findFirst({ where: { id: assetId, userId } }),
  ]);
  if (!fromWallet || !toWallet || !asset) return false;

  await prisma.transaction.updateMany({
    where: { assetId, walletId: fromWalletId, wallet: { userId } },
    data: { walletId: toWalletId },
  });
  return true;
}

// Deletes many transactions at once. Scoped through the wallet so a user
// can only ever delete their own. Returns the number actually deleted.
export async function deleteTransactionsBulk(
  userId: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await prisma.transaction.deleteMany({
    where: { id: { in: ids }, wallet: { userId } },
  });
  return result.count;
}

export type BulkTransactionRow = {
  type: TransactionType;
  executedAt: Date;
  unitPrice: number;
  quantity: number;
  amountInvested: number;
  fees: number;
  taxExempt?: boolean;
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

// Inserts many transactions at once, each carrying its own wallet and
// asset (used by the broker-file imports, which route transactions to
// different wallets by asset class). Returns the inserted count, or null
// if any wallet or asset isn't the user's.
export async function createBulkTransactions(
  userId: string,
  rows: (BulkTransactionRow & { walletId: string; assetId: string })[],
): Promise<number | null> {
  if (rows.length === 0) return 0;

  const walletIds = [...new Set(rows.map((row) => row.walletId))];
  const assetIds = [...new Set(rows.map((row) => row.assetId))];
  const [ownedWallets, ownedAssets] = await Promise.all([
    prisma.wallet.count({ where: { id: { in: walletIds }, userId } }),
    prisma.asset.count({ where: { id: { in: assetIds }, userId } }),
  ]);
  if (
    ownedWallets !== walletIds.length ||
    ownedAssets !== assetIds.length
  ) {
    return null;
  }

  const result = await prisma.transaction.createMany({
    data: rows.map((row) => ({
      walletId: row.walletId,
      assetId: row.assetId,
      type: row.type,
      executedAt: row.executedAt,
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      amountInvested: row.amountInvested,
      fees: row.fees,
      taxExempt: row.taxExempt ?? false,
    })),
  });
  return result.count;
}

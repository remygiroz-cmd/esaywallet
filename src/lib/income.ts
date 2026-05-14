import "server-only";
import { prisma } from "@/lib/prisma";
import type { IncomeKind } from "@/lib/constants";

export type IncomeInput = {
  walletId: string;
  assetId: string;
  kind: IncomeKind;
  receivedAt: Date;
  amount: number;
  fees: number;
  notes: string | null;
};

const incomeInclude = {
  wallet: { select: { id: true, name: true, currency: true } },
  asset: { select: { id: true, name: true, symbol: true } },
} as const;

export function getUserIncome(userId: string) {
  return prisma.income.findMany({
    where: { wallet: { userId } },
    orderBy: { receivedAt: "desc" },
    include: incomeInclude,
  });
}

// Confirms the wallet and asset both belong to the user before linking.
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

export async function createIncome(userId: string, data: IncomeInput) {
  if (!(await assertOwnership(userId, data.walletId, data.assetId))) {
    return null;
  }
  return prisma.income.create({ data });
}

export function deleteIncome(id: string, userId: string) {
  return prisma.income.deleteMany({ where: { id, wallet: { userId } } });
}

// Total income received, converted to the reference currency would need FX;
// for the dashboard total we sum amounts net of fees in their raw value —
// callers that need currency-correctness should convert per wallet.
export async function getIncomeTotalByCurrency(
  userId: string,
): Promise<Map<string, number>> {
  const rows = await getUserIncome(userId);
  const totals = new Map<string, number>();
  for (const row of rows) {
    const net = row.amount.toNumber() - row.fees.toNumber();
    totals.set(
      row.wallet.currency,
      (totals.get(row.wallet.currency) ?? 0) + net,
    );
  }
  return totals;
}

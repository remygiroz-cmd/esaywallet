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

export function getProfileIncome(profileId: string) {
  return prisma.income.findMany({
    where: { wallet: { profileId } },
    orderBy: { receivedAt: "desc" },
    include: incomeInclude,
  });
}

// Confirms the wallet and asset both belong to the profile before linking.
async function assertOwnership(
  profileId: string,
  walletId: string,
  assetId: string,
): Promise<boolean> {
  const [wallet, asset] = await Promise.all([
    prisma.wallet.findFirst({ where: { id: walletId, profileId } }),
    prisma.asset.findFirst({ where: { id: assetId, profileId } }),
  ]);
  return Boolean(wallet && asset);
}

export async function createIncome(profileId: string, data: IncomeInput) {
  if (!(await assertOwnership(profileId, data.walletId, data.assetId))) {
    return null;
  }
  return prisma.income.create({ data });
}

export function deleteIncome(id: string, profileId: string) {
  return prisma.income.deleteMany({
    where: { id, wallet: { profileId } },
  });
}

// Total income received, converted to the reference currency would need FX;
// for the dashboard total we sum amounts net of fees in their raw value —
// callers that need currency-correctness should convert per wallet.
export async function getIncomeTotalByCurrency(
  profileId: string,
): Promise<Map<string, number>> {
  const rows = await getProfileIncome(profileId);
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

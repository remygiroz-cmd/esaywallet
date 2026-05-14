import "server-only";
import { prisma } from "@/lib/prisma";
import type { PortfolioSnapshotPoint } from "@/lib/portfolio";

// Snapshots are keyed by UTC midnight so there is one row per calendar day.
function todayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

// Records (or refreshes) today's global portfolio snapshot. Called on every
// dashboard refresh so today's point tracks the live value, while previous
// days stay frozen — together they form the historical performance curve.
export async function recordGlobalSnapshot(
  userId: string,
  totalValue: number,
  totalInvested: number,
  currency: string,
): Promise<void> {
  const date = todayUtc();
  const existing = await prisma.portfolioSnapshot.findFirst({
    where: { userId, walletId: null, date },
  });

  if (existing) {
    await prisma.portfolioSnapshot.update({
      where: { id: existing.id },
      data: { totalValue, totalInvested, currency },
    });
  } else {
    await prisma.portfolioSnapshot.create({
      data: {
        userId,
        walletId: null,
        date,
        totalValue,
        totalInvested,
        currency,
      },
    });
  }
}

export async function getGlobalSnapshots(
  userId: string,
): Promise<PortfolioSnapshotPoint[]> {
  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: { userId, walletId: null },
    orderBy: { date: "asc" },
  });
  return snapshots.map((snapshot) => ({
    date: snapshot.date.toISOString(),
    totalValue: snapshot.totalValue.toNumber(),
    totalInvested: snapshot.totalInvested.toNumber(),
  }));
}

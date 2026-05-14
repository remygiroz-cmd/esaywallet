import "server-only";
import { prisma } from "@/lib/prisma";

export type RealizedGainEntryInput = {
  year: number;
  securityName: string;
  securityCode: string | null;
  proceeds: number;
  realizedGain: number;
};

const entryInclude = {
  wallet: {
    select: {
      id: true,
      name: true,
      type: true,
      taxRate: true,
      openedAt: true,
      currency: true,
    },
  },
} as const;

export function getUserRealizedGainEntries(userId: string) {
  return prisma.realizedGainEntry.findMany({
    where: { userId },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    include: entryInclude,
  });
}

// Bulk-inserts a bank statement's realised-gain lines, all attributed to
// one wallet and tax year. Returns the inserted count, or null when the
// wallet isn't the user's.
export async function createRealizedGainEntries(
  userId: string,
  walletId: string,
  year: number,
  source: string | null,
  rows: RealizedGainEntryInput[],
): Promise<number | null> {
  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId },
  });
  if (!wallet) return null;
  if (rows.length === 0) return 0;

  const result = await prisma.realizedGainEntry.createMany({
    data: rows.map((row) => ({
      userId,
      walletId,
      year,
      securityName: row.securityName,
      securityCode: row.securityCode,
      proceeds: row.proceeds,
      realizedGain: row.realizedGain,
      source,
    })),
  });
  return result.count;
}

export function deleteRealizedGainEntry(id: string, userId: string) {
  return prisma.realizedGainEntry.deleteMany({ where: { id, userId } });
}

import "server-only";
import { prisma } from "@/lib/prisma";

export type DividendInput = {
  walletId: string | null;
  assetId: string | null;
  source: string;
  receivedAt: Date;
  grossAmount: number;
  withheldTax: number;
  currency: string;
  taxRate: number | null;
  notes: string | null;
};

const dividendInclude = {
  wallet: { select: { id: true, name: true, currency: true, type: true } },
  asset: { select: { id: true, name: true, symbol: true } },
} as const;

export function getProfileDividends(profileId: string) {
  return prisma.dividend.findMany({
    where: { profileId },
    orderBy: { receivedAt: "desc" },
    include: dividendInclude,
  });
}

// Confirms the optional wallet/asset both belong to the profile before
// linking. Either may be null — only entries that the caller passed are
// validated.
async function assertOwnership(
  profileId: string,
  walletId: string | null,
  assetId: string | null,
): Promise<boolean> {
  if (walletId) {
    const wallet = await prisma.wallet.findFirst({
      where: { id: walletId, profileId },
      select: { id: true },
    });
    if (!wallet) return false;
  }
  if (assetId) {
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, profileId },
      select: { id: true },
    });
    if (!asset) return false;
  }
  return true;
}

export async function createDividend(profileId: string, data: DividendInput) {
  if (!(await assertOwnership(profileId, data.walletId, data.assetId))) {
    return null;
  }
  return prisma.dividend.create({ data: { ...data, profileId } });
}

export function deleteDividend(id: string, profileId: string) {
  return prisma.dividend.deleteMany({
    where: { id, profileId },
  });
}

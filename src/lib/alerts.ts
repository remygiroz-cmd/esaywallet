import "server-only";
import { prisma } from "@/lib/prisma";
import type { AlertDirection } from "@/lib/constants";

export type AlertInput = {
  assetId: string;
  direction: AlertDirection;
  threshold: number;
  note: string | null;
};

const alertInclude = {
  asset: {
    select: { id: true, name: true, symbol: true, quoteCurrency: true },
  },
} as const;

export function getUserAlerts(userId: string) {
  return prisma.priceAlert.findMany({
    where: { userId },
    orderBy: [{ triggeredAt: "desc" }, { createdAt: "desc" }],
    include: alertInclude,
  });
}

export async function createAlert(userId: string, data: AlertInput) {
  const asset = await prisma.asset.findFirst({
    where: { id: data.assetId, userId },
  });
  if (!asset) return null;
  return prisma.priceAlert.create({
    data: {
      userId,
      assetId: data.assetId,
      direction: data.direction,
      threshold: data.threshold,
      note: data.note,
    },
  });
}

export function deleteAlert(id: string, userId: string) {
  return prisma.priceAlert.deleteMany({ where: { id, userId } });
}

// Clears the triggered flag so the alert is armed again.
export function rearmAlert(id: string, userId: string) {
  return prisma.priceAlert.updateMany({
    where: { id, userId },
    data: { triggeredAt: null },
  });
}

// Checks every armed alert against the latest cached price and flags the
// ones whose threshold has been crossed. Called on each dashboard refresh.
export async function evaluateAlerts(userId: string): Promise<number> {
  const alerts = await prisma.priceAlert.findMany({
    where: { userId, triggeredAt: null },
    include: { asset: { select: { price: true } } },
  });

  const now = new Date();
  let triggered = 0;
  for (const alert of alerts) {
    const price = alert.asset.price;
    if (!price) continue;
    const current = price.price.toNumber();
    const threshold = alert.threshold.toNumber();
    const crossed =
      alert.direction === "ABOVE"
        ? current >= threshold
        : current <= threshold;
    if (crossed) {
      await prisma.priceAlert.update({
        where: { id: alert.id },
        data: { triggeredAt: now },
      });
      triggered += 1;
    }
  }
  return triggered;
}

export type TriggeredAlert = {
  id: string;
  assetName: string;
  assetSymbol: string;
  direction: AlertDirection;
  threshold: number;
  currency: string;
  currentPrice: number | null;
  triggeredAt: string;
  note: string | null;
};

export async function getTriggeredAlerts(
  userId: string,
): Promise<TriggeredAlert[]> {
  const alerts = await prisma.priceAlert.findMany({
    where: { userId, triggeredAt: { not: null } },
    orderBy: { triggeredAt: "desc" },
    include: {
      asset: {
        select: {
          name: true,
          symbol: true,
          quoteCurrency: true,
          price: true,
        },
      },
    },
  });

  return alerts.map((alert) => ({
    id: alert.id,
    assetName: alert.asset.name,
    assetSymbol: alert.asset.symbol,
    direction: alert.direction as AlertDirection,
    threshold: alert.threshold.toNumber(),
    currency: alert.asset.quoteCurrency,
    currentPrice: alert.asset.price?.price.toNumber() ?? null,
    triggeredAt: (alert.triggeredAt as Date).toISOString(),
    note: alert.note,
  }));
}

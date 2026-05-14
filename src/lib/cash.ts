import "server-only";
import { prisma } from "@/lib/prisma";
import type { CashMovementKind } from "@/lib/constants";

export type CashMovementInput = {
  kind: CashMovementKind;
  amount: number;
  occurredAt: Date;
  note: string | null;
};

export function getWalletCashMovements(walletId: string, userId: string) {
  return prisma.cashMovement.findMany({
    where: { walletId, wallet: { userId } },
    orderBy: { occurredAt: "desc" },
  });
}

export async function createCashMovement(
  walletId: string,
  userId: string,
  data: CashMovementInput,
) {
  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId },
  });
  if (!wallet) return null;
  return prisma.cashMovement.create({ data: { ...data, walletId } });
}

export function deleteCashMovement(id: string, userId: string) {
  return prisma.cashMovement.deleteMany({
    where: { id, wallet: { userId } },
  });
}

// The cash balance of every wallet, in the wallet's own currency:
// deposits − withdrawals − buy outflows + sell proceeds + income received.
export async function getCashByWallet(
  userId: string,
): Promise<Map<string, number>> {
  const [movements, transactions, income] = await Promise.all([
    prisma.cashMovement.findMany({
      where: { wallet: { userId } },
      select: { walletId: true, kind: true, amount: true },
    }),
    prisma.transaction.findMany({
      where: { wallet: { userId } },
      select: { walletId: true, type: true, amountInvested: true, fees: true },
    }),
    prisma.income.findMany({
      where: { wallet: { userId } },
      select: { walletId: true, amount: true, fees: true },
    }),
  ]);

  const cash = new Map<string, number>();
  const add = (walletId: string, value: number) => {
    cash.set(walletId, (cash.get(walletId) ?? 0) + value);
  };

  for (const movement of movements) {
    const amount = movement.amount.toNumber();
    add(movement.walletId, movement.kind === "DEPOSIT" ? amount : -amount);
  }
  for (const tx of transactions) {
    const amount = tx.amountInvested.toNumber();
    const fees = tx.fees.toNumber();
    add(tx.walletId, tx.type === "SELL" ? amount - fees : -(amount + fees));
  }
  for (const entry of income) {
    add(entry.walletId, entry.amount.toNumber() - entry.fees.toNumber());
  }

  return cash;
}

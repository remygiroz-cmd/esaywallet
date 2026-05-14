import "server-only";
import { prisma } from "@/lib/prisma";
import { loadPortfolio } from "@/lib/portfolio-server";
import { getUserIncome } from "@/lib/income";
import { buildFxRateMap, convertCurrency } from "@/lib/currency";

// A realised sale, with everything the tax view needs — amounts converted
// to EUR so figures across wallets can be summed.
export type FiscalSale = {
  transactionId: string;
  executedAt: string;
  assetId: string;
  assetName: string;
  assetSymbol: string;
  walletId: string;
  walletName: string;
  walletType: string;
  taxRate: number; // ratio
  quantity: number;
  proceeds: number; // EUR, net of fees
  costOfSold: number; // EUR, PMP-based
  realizedGain: number; // EUR
};

// A received income entry (dividend, coupon, staking, interest), converted
// to EUR. Dividends and similar income are taxable at the wallet's rate.
export type FiscalIncome = {
  id: string;
  receivedAt: string;
  kind: string;
  assetName: string;
  assetSymbol: string;
  walletId: string;
  walletName: string;
  walletType: string;
  taxRate: number; // ratio
  net: number; // EUR, amount net of fees
};

export type FiscalData = {
  sales: FiscalSale[];
  income: FiscalIncome[];
  adjustments: { year: number; carryForwardLoss: number }[];
};

export async function loadFiscalData(userId: string): Promise<FiscalData> {
  const [portfolio, income, adjustments, fxRates] = await Promise.all([
    loadPortfolio(userId),
    getUserIncome(userId),
    prisma.taxAdjustment.findMany({
      where: { userId },
      orderBy: { year: "desc" },
    }),
    prisma.fxRate.findMany({ where: { base: "EUR" } }),
  ]);

  const fx = buildFxRateMap(
    fxRates.map((rate) => ({ quote: rate.quote, rate: rate.rate.toNumber() })),
  );
  const toEur = (amount: number, from: string): number =>
    convertCurrency(amount, from, "EUR", fx) ?? amount;

  const walletMeta = new Map(
    portfolio.wallets.map((wallet) => [
      wallet.walletId,
      { type: wallet.type, taxRate: wallet.taxRate, currency: wallet.currency },
    ]),
  );

  const sales: FiscalSale[] = [];
  for (const asset of portfolio.assets) {
    for (const sale of asset.sales) {
      const meta = walletMeta.get(sale.walletId);
      const currency = meta?.currency ?? "EUR";
      sales.push({
        transactionId: sale.transactionId,
        executedAt: sale.executedAt,
        assetId: sale.assetId,
        assetName: sale.assetName,
        assetSymbol: sale.assetSymbol,
        walletId: sale.walletId,
        walletName: sale.walletName,
        walletType: meta?.type ?? "OTHER",
        taxRate: meta?.taxRate ?? 0.3,
        quantity: sale.quantity,
        proceeds: toEur(sale.proceeds, currency),
        costOfSold: toEur(sale.costOfSold, currency),
        realizedGain: toEur(sale.realizedGain, currency),
      });
    }
  }
  sales.sort((a, b) => (a.executedAt < b.executedAt ? 1 : -1));

  const incomeRows: FiscalIncome[] = income.map((entry) => {
    const meta = walletMeta.get(entry.walletId);
    const currency = meta?.currency ?? entry.wallet.currency;
    const net = entry.amount.toNumber() - entry.fees.toNumber();
    return {
      id: entry.id,
      receivedAt: entry.receivedAt.toISOString(),
      kind: entry.kind,
      assetName: entry.asset.name,
      assetSymbol: entry.asset.symbol,
      walletId: entry.walletId,
      walletName: entry.wallet.name,
      walletType: meta?.type ?? "OTHER",
      taxRate: meta?.taxRate ?? 0.3,
      net: toEur(net, currency),
    };
  });
  incomeRows.sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));

  return {
    sales,
    income: incomeRows,
    adjustments: adjustments.map((adjustment) => ({
      year: adjustment.year,
      carryForwardLoss: adjustment.carryForwardLoss.toNumber(),
    })),
  };
}

export async function upsertTaxAdjustment(
  userId: string,
  year: number,
  carryForwardLoss: number,
): Promise<void> {
  await prisma.taxAdjustment.upsert({
    where: { userId_year: { userId, year } },
    create: { userId, year, carryForwardLoss },
    update: { carryForwardLoss },
  });
}

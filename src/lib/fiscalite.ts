import "server-only";
import { prisma } from "@/lib/prisma";
import { loadPortfolio } from "@/lib/portfolio-server";
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

export type FiscalData = {
  sales: FiscalSale[];
  adjustments: { year: number; carryForwardLoss: number }[];
};

export async function loadFiscalData(userId: string): Promise<FiscalData> {
  const [portfolio, adjustments, fxRates] = await Promise.all([
    loadPortfolio(userId),
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

  return {
    sales,
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

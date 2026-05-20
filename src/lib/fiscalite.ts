import "server-only";
import { prisma } from "@/lib/prisma";
import { loadPortfolio } from "@/lib/portfolio-server";
import { getProfileIncome } from "@/lib/income";
import { getProfileDividends } from "@/lib/dividends";
import { getProfileRealizedGainEntries } from "@/lib/realized-gains";
import {
  taxRateForWalletAt,
  taxRateForWalletType,
  PEA_MATURITY_YEARS,
} from "@/lib/constants";
import { buildFxRateMap, convertCurrency } from "@/lib/currency";

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

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
  // Whether this sale enters the taxable base. A PEA sale is an internal
  // move (taxed on withdrawal, not here); a crypto-to-crypto swap or a
  // transfer is flagged tax-exempt on the transaction.
  taxable: boolean;
  taxExempt: boolean;
  // True when this line comes from an imported bank realised-gains
  // statement rather than reconstructed from transactions.
  fromStatement: boolean;
};

// A received income entry (dividend, coupon, staking, interest), converted
// to EUR. Income inside a PEA is tax-exempt while it stays in the plan.
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
  taxable: boolean;
};

// A PEA withdrawal — the taxable event for a PEA. A withdrawal before the
// 5-year mark closes the plan and makes the gains taxable; the exact
// taxable amount depends on the gain ratio at the time, so it is flagged
// for manual review rather than auto-computed.
export type FiscalWithdrawal = {
  id: string;
  occurredAt: string;
  walletId: string;
  walletName: string;
  amount: number; // EUR
  beforeMaturity: boolean;
  openedAt: string | null;
  note: string | null;
};

// A dividend received — tracked purely for tax reporting. The gross
// amount and any tax already withheld at source are converted to EUR.
// Like income, dividends inside a PEA are exempt while in the plan.
export type FiscalDividend = {
  id: string;
  receivedAt: string;
  source: string;
  assetName: string | null;
  assetSymbol: string | null;
  walletId: string | null;
  walletName: string | null;
  walletType: string | null;
  taxRate: number; // ratio
  gross: number; // EUR
  withheldTax: number; // EUR
  taxable: boolean;
};

export type FiscalData = {
  sales: FiscalSale[];
  income: FiscalIncome[];
  dividends: FiscalDividend[];
  withdrawals: FiscalWithdrawal[];
  adjustments: { year: number; carryForwardLoss: number }[];
};

export async function loadFiscalData(profileId: string): Promise<FiscalData> {
  const [
    portfolio,
    income,
    dividends,
    realizedEntries,
    walletRows,
    peaWithdrawals,
    adjustments,
    fxRates,
  ] = await Promise.all([
      loadPortfolio(profileId),
      getProfileIncome(profileId),
      getProfileDividends(profileId),
      getProfileRealizedGainEntries(profileId),
      prisma.wallet.findMany({
        where: { profileId },
        select: {
          id: true,
          type: true,
          name: true,
          taxRate: true,
          openedAt: true,
          currency: true,
        },
      }),
      prisma.cashMovement.findMany({
        where: { kind: "WITHDRAWAL", wallet: { profileId, type: "PEA" } },
        orderBy: { occurredAt: "desc" },
        include: {
          wallet: {
            select: { name: true, openedAt: true, currency: true },
          },
        },
      }),
      prisma.taxAdjustment.findMany({
        where: { profileId },
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
    walletRows.map((wallet) => [
      wallet.id,
      {
        type: wallet.type,
        name: wallet.name,
        taxRate: wallet.taxRate,
        openedAt: wallet.openedAt?.toISOString() ?? null,
        currency: wallet.currency,
      },
    ]),
  );

  // The tax rate applying to a sale/income, on its own date (PEA 5-year rule).
  const rateAt = (
    meta:
      | { type: string; taxRate: number | null; openedAt: string | null }
      | undefined,
    dateIso: string,
  ): number =>
    taxRateForWalletAt(
      {
        type: meta?.type ?? "OTHER",
        taxRate: meta?.taxRate ?? null,
        openedAt: meta?.openedAt ?? null,
      },
      dateIso,
    );

  const sales: FiscalSale[] = [];
  for (const asset of portfolio.assets) {
    for (const sale of asset.sales) {
      const meta = walletMeta.get(sale.walletId);
      const currency = meta?.currency ?? "EUR";
      const walletType = meta?.type ?? "OTHER";
      // A PEA sale is internal (taxed on withdrawal); a flagged sale is a
      // swap/transfer. Neither enters the taxable base.
      const taxable = !sale.taxExempt && walletType !== "PEA";
      sales.push({
        transactionId: sale.transactionId,
        executedAt: sale.executedAt,
        assetId: sale.assetId,
        assetName: sale.assetName,
        assetSymbol: sale.assetSymbol,
        walletId: sale.walletId,
        walletName: sale.walletName,
        walletType,
        taxRate: rateAt(meta, sale.executedAt),
        quantity: sale.quantity,
        proceeds: toEur(sale.proceeds, currency),
        costOfSold: toEur(sale.costOfSold, currency),
        realizedGain: toEur(sale.realizedGain, currency),
        taxable,
        taxExempt: sale.taxExempt,
        fromStatement: false,
      });
    }
  }

  // Imported bank statements: the realised gain is already computed, so
  // each line becomes an authoritative sale dated at the tax year-end.
  for (const entry of realizedEntries) {
    const meta = entry.walletId
      ? walletMeta.get(entry.walletId)
      : undefined;
    const walletType = meta?.type ?? "CTO";
    // Mid-year, noon UTC — keeps the entry firmly inside its tax year
    // whatever the viewer's timezone.
    const executedAt = `${entry.year}-06-30T12:00:00.000Z`;
    const realizedGain = entry.realizedGain.toNumber();
    const proceeds = entry.proceeds.toNumber();
    sales.push({
      transactionId: `statement-${entry.id}`,
      executedAt,
      assetId: `statement-${entry.id}`,
      assetName: entry.securityName,
      assetSymbol: entry.securityCode ?? "",
      walletId: entry.walletId ?? "statement",
      walletName: entry.wallet?.name ?? "Relevé importé",
      walletType,
      taxRate: rateAt(meta, executedAt),
      quantity: 0,
      proceeds,
      costOfSold: proceeds - realizedGain,
      realizedGain,
      // A bank realised-gains statement is for a taxable account.
      taxable: walletType !== "PEA",
      taxExempt: false,
      fromStatement: true,
    });
  }

  sales.sort((a, b) => (a.executedAt < b.executedAt ? 1 : -1));

  const incomeRows: FiscalIncome[] = income.map((entry) => {
    const meta = walletMeta.get(entry.walletId);
    const currency = meta?.currency ?? entry.wallet.currency;
    const net = entry.amount.toNumber() - entry.fees.toNumber();
    const walletType = meta?.type ?? "OTHER";
    return {
      id: entry.id,
      receivedAt: entry.receivedAt.toISOString(),
      kind: entry.kind,
      assetName: entry.asset.name,
      assetSymbol: entry.asset.symbol,
      walletId: entry.walletId,
      walletName: entry.wallet.name,
      walletType,
      taxRate: rateAt(meta, entry.receivedAt.toISOString()),
      net: toEur(net, currency),
      // Income earned inside a PEA is exempt while it stays in the plan.
      taxable: walletType !== "PEA",
    };
  });
  incomeRows.sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));

  // Dividends are purely informational for cash/portfolio purposes but
  // feed directly into the tax base. The rate falls back to a manual
  // override, then to the linked wallet's rate (with PEA 5-year rule),
  // then to the CTO/PFU default.
  const dividendRows: FiscalDividend[] = dividends.map((entry) => {
    const meta = entry.walletId ? walletMeta.get(entry.walletId) : undefined;
    const walletType = meta?.type ?? null;
    const fallbackRate =
      entry.taxRate ??
      (meta
        ? rateAt(meta, entry.receivedAt.toISOString())
        : taxRateForWalletType("CTO"));
    return {
      id: entry.id,
      receivedAt: entry.receivedAt.toISOString(),
      source: entry.source,
      assetName: entry.asset?.name ?? null,
      assetSymbol: entry.asset?.symbol ?? null,
      walletId: entry.walletId ?? null,
      walletName: meta?.name ?? entry.wallet?.name ?? null,
      walletType,
      taxRate: fallbackRate,
      gross: toEur(entry.grossAmount.toNumber(), entry.currency),
      withheldTax: toEur(entry.withheldTax.toNumber(), entry.currency),
      // PEA dividends are exempt while in the plan, matching Income.
      taxable: walletType !== "PEA",
    };
  });
  dividendRows.sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));

  const withdrawals: FiscalWithdrawal[] = peaWithdrawals.map((movement) => {
    const openedAt = movement.wallet.openedAt;
    const occurredAt = movement.occurredAt;
    const beforeMaturity =
      openedAt !== null &&
      occurredAt.getTime() - openedAt.getTime() <
        PEA_MATURITY_YEARS * YEAR_MS;
    return {
      id: movement.id,
      occurredAt: occurredAt.toISOString(),
      walletId: movement.walletId,
      walletName: movement.wallet.name,
      amount: toEur(movement.amount.toNumber(), movement.wallet.currency),
      beforeMaturity,
      openedAt: openedAt?.toISOString() ?? null,
      note: movement.note,
    };
  });

  return {
    sales,
    income: incomeRows,
    dividends: dividendRows,
    withdrawals,
    adjustments: adjustments.map((adjustment) => ({
      year: adjustment.year,
      carryForwardLoss: adjustment.carryForwardLoss.toNumber(),
    })),
  };
}

export async function upsertTaxAdjustment(
  profileId: string,
  year: number,
  carryForwardLoss: number,
): Promise<void> {
  await prisma.taxAdjustment.upsert({
    where: { profileId_year: { profileId, year } },
    create: { profileId, year, carryForwardLoss },
    update: { carryForwardLoss },
  });
}

"use client";

import { useActionState, useMemo, useState } from "react";
import {
  saveTaxAdjustmentAction,
  type TaxAdjustmentState,
} from "@/app/(app)/fiscalite/actions";
import type {
  FiscalSale,
  FiscalIncome,
  FiscalWithdrawal,
} from "@/lib/fiscalite";
import { INCOME_KIND_LABELS, type IncomeKind } from "@/lib/constants";
import {
  formatCurrency,
  formatSignedCurrency,
  formatPercent,
  formatQuantity,
  formatDate,
} from "@/lib/format";
import { ui } from "@/lib/ui";
import { GainBadge } from "./gain-badge";

type Props = {
  sales: FiscalSale[];
  income: FiscalIncome[];
  withdrawals: FiscalWithdrawal[];
  adjustments: { year: number; carryForwardLoss: number }[];
};

const adjustmentInitial: TaxAdjustmentState = {};

function csvField(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function FiscaliteView({
  sales,
  income,
  withdrawals,
  adjustments,
}: Props) {
  const availableYears = useMemo(
    () =>
      [
        ...new Set([
          ...sales.map((sale) => new Date(sale.executedAt).getFullYear()),
          ...income.map((entry) =>
            new Date(entry.receivedAt).getFullYear(),
          ),
          ...withdrawals.map((w) => new Date(w.occurredAt).getFullYear()),
        ]),
      ].sort((a, b) => b - a),
    [sales, income, withdrawals],
  );

  const currentYear = new Date().getFullYear();
  const defaultYear =
    availableYears.find((year) => year < currentYear) ??
    availableYears[0] ??
    currentYear;

  const [mode, setMode] = useState<"year" | "range">("year");
  const [year, setYear] = useState(defaultYear);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    if (mode === "year") {
      return sales.filter(
        (sale) => new Date(sale.executedAt).getFullYear() === year,
      );
    }
    const fromTime = from ? new Date(from).getTime() : -Infinity;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : Infinity;
    return sales.filter((sale) => {
      const time = new Date(sale.executedAt).getTime();
      return time >= fromTime && time <= toTime;
    });
  }, [sales, mode, year, from, to]);

  const filteredIncome = useMemo(() => {
    if (mode === "year") {
      return income.filter(
        (entry) => new Date(entry.receivedAt).getFullYear() === year,
      );
    }
    const fromTime = from ? new Date(from).getTime() : -Infinity;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : Infinity;
    return income.filter((entry) => {
      const time = new Date(entry.receivedAt).getTime();
      return time >= fromTime && time <= toTime;
    });
  }, [income, mode, year, from, to]);

  const filteredWithdrawals = useMemo(() => {
    if (mode === "year") {
      return withdrawals.filter(
        (w) => new Date(w.occurredAt).getFullYear() === year,
      );
    }
    const fromTime = from ? new Date(from).getTime() : -Infinity;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : Infinity;
    return withdrawals.filter((w) => {
      const time = new Date(w.occurredAt).getTime();
      return time >= fromTime && time <= toTime;
    });
  }, [withdrawals, mode, year, from, to]);

  const carryForward =
    mode === "year"
      ? (adjustments.find((a) => a.year === year)?.carryForwardLoss ?? 0)
      : 0;

  const summary = useMemo(() => {
    const perWallet = new Map<
      string,
      {
        name: string;
        realizedGain: number;
        count: number;
        income: number;
        incomeCount: number;
        estimatedTax: number;
        rates: Set<number>;
      }
    >();
    const perAsset = new Map<
      string,
      { name: string; symbol: string; realizedGain: number; count: number }
    >();
    let netRealized = 0;
    let taxableRealized = 0;
    let nonTaxableCount = 0;
    let totalIncome = 0;

    const getWallet = (id: string, name: string) => {
      const existing = perWallet.get(id);
      if (existing) return existing;
      const created = {
        name,
        realizedGain: 0,
        count: 0,
        income: 0,
        incomeCount: 0,
        estimatedTax: 0,
        rates: new Set<number>(),
      };
      perWallet.set(id, created);
      return created;
    };

    for (const sale of filtered) {
      netRealized += sale.realizedGain;
      if (!sale.taxable) nonTaxableCount += 1;
      const wallet = getWallet(sale.walletId, sale.walletName);
      wallet.realizedGain += sale.realizedGain;
      wallet.count += 1;
      // Only taxable sales feed the taxable base and the estimated tax.
      // Each is taxed at its own rate (PEA 5-year rule).
      if (sale.taxable) {
        taxableRealized += sale.realizedGain;
        wallet.estimatedTax += Math.max(0, sale.realizedGain) * sale.taxRate;
        wallet.rates.add(sale.taxRate);
      }

      const asset = perAsset.get(sale.assetId) ?? {
        name: sale.assetName,
        symbol: sale.assetSymbol,
        realizedGain: 0,
        count: 0,
      };
      asset.realizedGain += sale.realizedGain;
      asset.count += 1;
      perAsset.set(sale.assetId, asset);
    }

    for (const entry of filteredIncome) {
      totalIncome += entry.net;
      const wallet = getWallet(entry.walletId, entry.walletName);
      wallet.income += entry.net;
      wallet.incomeCount += 1;
      if (entry.taxable) {
        wallet.estimatedTax += Math.max(0, entry.net) * entry.taxRate;
        wallet.rates.add(entry.taxRate);
      }
    }

    const wallets = [...perWallet.values()].sort(
      (a, b) =>
        b.realizedGain + b.income - (a.realizedGain + a.income),
    );
    const assets = [...perAsset.values()].sort(
      (a, b) => b.realizedGain - a.realizedGain,
    );

    // Carry-forward losses reduce taxable gains, distributed proportionally
    // across each taxable positive-gain sale (taxed at its own rate). Income
    // is taxed separately at its own rate, without carry-forward.
    const taxableSales = filtered.filter((sale) => sale.taxable);
    const totalPositiveGain = taxableSales.reduce(
      (sum, sale) => sum + Math.max(0, sale.realizedGain),
      0,
    );
    let estimatedTax = 0;
    for (const sale of taxableSales) {
      const positive = Math.max(0, sale.realizedGain);
      const share =
        totalPositiveGain > 0
          ? carryForward * (positive / totalPositiveGain)
          : 0;
      estimatedTax += Math.max(0, sale.realizedGain - share) * sale.taxRate;
    }
    for (const entry of filteredIncome) {
      if (entry.taxable) {
        estimatedTax += Math.max(0, entry.net) * entry.taxRate;
      }
    }

    return {
      wallets,
      assets,
      netRealized,
      taxableRealized,
      nonTaxableCount,
      totalIncome,
      netTaxable: Math.max(0, taxableRealized - carryForward),
      estimatedTax,
    };
  }, [filtered, filteredIncome, carryForward]);

  function exportCsv() {
    const header = [
      "Date",
      "Asset",
      "Symbole",
      "Wallet",
      "Quantité",
      "Montant reçu (EUR)",
      "Coût PMP (EUR)",
      "Plus-value réalisée (EUR)",
      "Imposable",
    ]
      .map(csvField)
      .join(",");
    const rows = filtered.map((sale) =>
      [
        formatDate(sale.executedAt),
        sale.assetName,
        sale.assetSymbol,
        sale.walletName,
        sale.quantity,
        sale.proceeds.toFixed(2),
        sale.costOfSold.toFixed(2),
        sale.realizedGain.toFixed(2),
        sale.taxable
          ? "oui"
          : sale.walletType === "PEA"
            ? "non (PEA, au retrait)"
            : "non",
      ]
        .map(csvField)
        .join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fiscalite-${mode === "year" ? year : "periode"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2">
        {availableYears.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setMode("year");
              setYear(option);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "year" && year === option
                ? "bg-emerald-600 text-white"
                : "border border-black/[.12] text-zinc-600 hover:bg-zinc-100 dark:border-white/[.16] dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            {option}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMode("range")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "range"
              ? "bg-emerald-600 text-white"
              : "border border-black/[.12] text-zinc-600 hover:bg-zinc-100 dark:border-white/[.16] dark:text-zinc-400 dark:hover:bg-zinc-900"
          }`}
        >
          Période personnalisée
        </button>
      </div>

      {mode === "range" ? (
        <div className="flex flex-wrap gap-4">
          <label className={ui.label}>
            Du
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className={ui.input}
            />
          </label>
          <label className={ui.label}>
            Au
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className={ui.input}
            />
          </label>
        </div>
      ) : null}

      {/* Synthèse */}
      <div className="rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.12] dark:bg-zinc-950">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
          Synthèse — {mode === "year" ? year : "période personnalisée"}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <p
              className={`text-2xl font-semibold tabular-nums ${
                summary.netRealized >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatSignedCurrency(summary.netRealized, "EUR")}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Plus / moins-value réalisée ({filtered.length} vente
              {filtered.length === 1 ? "" : "s"}
              {summary.nonTaxableCount > 0
                ? `, dont ${summary.nonTaxableCount} non imposable${
                    summary.nonTaxableCount === 1 ? "" : "s"
                  }`
                : ""}
              )
            </p>
          </div>
          <div>
            <p className="text-base font-medium text-zinc-600 tabular-nums dark:text-zinc-300">
              {formatCurrency(summary.netTaxable, "EUR")}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Plus-value nette imposable
            </p>
          </div>
          <div>
            <p className="text-base font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
              {formatCurrency(summary.totalIncome, "EUR")}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Revenus perçus ({filteredIncome.length} versement
              {filteredIncome.length === 1 ? "" : "s"})
            </p>
          </div>
          <div>
            <p className="text-base font-medium text-zinc-600 tabular-nums dark:text-zinc-300">
              {formatCurrency(summary.estimatedTax, "EUR")}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Impôt estimé (ventes + revenus)
            </p>
          </div>
        </div>

        {mode === "year" ? (
          <CarryForwardForm
            key={`${year}:${carryForward}`}
            year={year}
            carryForward={carryForward}
          />
        ) : null}

        <p className="mt-4 text-xs text-zinc-400">
          Estimation indicative. Ne sont pas comptées dans la base imposable :
          les ventes internes d&apos;un PEA (imposées au retrait — voir
          ci-dessous), les conversions crypto↔crypto et les transferts marqués
          « non imposables ». La fiscalité réelle dépend aussi de règles que
          l&apos;application ne connaît pas (durée de détention, abattements…).
          Ajustez le taux sur chaque wallet et les moins-values reportables.
        </p>
      </div>

      {/* Per wallet */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Par wallet
        </h2>
        {summary.wallets.length === 0 ? (
          <p className={ui.subtle}>Aucune vente ni revenu sur cette période.</p>
        ) : (
          <div className={`${ui.card} overflow-x-auto p-0`}>
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
                  <th className="px-4 py-3 font-medium">Wallet</th>
                  <th className="px-4 py-3 text-right font-medium">Ventes</th>
                  <th className="px-4 py-3 text-right font-medium">Taux</th>
                  <th className="px-4 py-3 text-right font-medium">
                    +/- value réalisée
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Revenus</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Impôt estimé
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.wallets.map((wallet) => (
                  <tr
                    key={wallet.name}
                    className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                  >
                    <td className="px-4 py-3 font-medium text-black dark:text-zinc-50">
                      {wallet.name}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                      {wallet.count}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                      {wallet.rates.size === 0
                        ? "—"
                        : wallet.rates.size === 1
                          ? formatPercent([...wallet.rates][0])
                          : "variable"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <GainBadge
                        gain={wallet.realizedGain}
                        gainPct={0}
                        currency="EUR"
                        size="sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {wallet.income > 0
                        ? formatCurrency(wallet.income, "EUR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                      {formatCurrency(wallet.estimatedTax, "EUR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sale detail */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Détail des ventes
          </h2>
          {filtered.length > 0 ? (
            <button
              type="button"
              onClick={exportCsv}
              className={ui.secondaryButton}
            >
              Exporter en CSV
            </button>
          ) : null}
        </div>
        {filtered.length === 0 ? (
          <p className={ui.subtle}>Aucune vente sur cette période.</p>
        ) : (
          <div className={`${ui.card} overflow-x-auto p-0`}>
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Asset</th>
                  <th className="px-4 py-3 font-medium">Wallet</th>
                  <th className="px-4 py-3 text-right font-medium">Quantité</th>
                  <th className="px-4 py-3 text-right font-medium">Reçu</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Coût (PMP)
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    +/- value
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sale) => (
                  <tr
                    key={sale.transactionId}
                    className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {formatDate(sale.executedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-black dark:text-zinc-50">
                        {sale.assetName}
                      </span>{" "}
                      <span className="font-mono text-xs text-zinc-400">
                        {sale.assetSymbol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {sale.walletName}
                      {!sale.taxable ? (
                        <span className="mt-0.5 block text-xs text-amber-600 dark:text-amber-400">
                          {sale.walletType === "PEA"
                            ? "PEA · imposé au retrait"
                            : "non imposable"}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                      {formatQuantity(sale.quantity)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                      {formatCurrency(sale.proceeds, "EUR")}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                      {formatCurrency(sale.costOfSold, "EUR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <GainBadge
                        gain={sale.realizedGain}
                        gainPct={0}
                        currency="EUR"
                        size="sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Income detail */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Détail des revenus
        </h2>
        {filteredIncome.length === 0 ? (
          <p className={ui.subtle}>Aucun revenu sur cette période.</p>
        ) : (
          <div className={`${ui.card} overflow-x-auto p-0`}>
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Asset</th>
                  <th className="px-4 py-3 font-medium">Wallet</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Montant net
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredIncome.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {formatDate(entry.receivedAt)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {INCOME_KIND_LABELS[entry.kind as IncomeKind] ??
                        entry.kind}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-black dark:text-zinc-50">
                        {entry.assetName}
                      </span>{" "}
                      <span className="font-mono text-xs text-zinc-400">
                        {entry.assetSymbol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {entry.walletName}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(entry.net, "EUR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* PEA withdrawals — the taxable event for a PEA */}
      {withdrawals.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Retraits PEA
          </h2>
          {filteredWithdrawals.length === 0 ? (
            <p className={ui.subtle}>Aucun retrait sur cette période.</p>
          ) : (
            <>
              <div className={`${ui.card} overflow-x-auto p-0`}>
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Wallet</th>
                      <th className="px-4 py-3 font-medium">Statut fiscal</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Montant
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWithdrawals.map((w) => (
                      <tr
                        key={w.id}
                        className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                          {formatDate(w.occurredAt)}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                          {w.walletName}
                        </td>
                        <td className="px-4 py-3">
                          {w.beforeMaturity ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              Avant 5 ans — potentiellement imposable
                            </span>
                          ) : w.openedAt ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Après 5 ans — exonéré
                            </span>
                          ) : (
                            <span className="text-zinc-500 dark:text-zinc-400">
                              Date d&apos;ouverture du PEA inconnue
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-zinc-700 dark:text-zinc-200">
                          {formatCurrency(w.amount, "EUR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-zinc-400">
                Pour un PEA, l&apos;événement imposable est le retrait, pas la
                vente interne. Un retrait avant 5 ans rend la part de gain
                imposable et clôture le plan ; le montant exact dépend du
                ratio de plus-value au moment du retrait — à calculer et
                déclarer manuellement. Renseignez la date d&apos;ouverture du
                PEA dans ses paramètres pour fiabiliser ce statut.
              </p>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function CarryForwardForm({
  year,
  carryForward,
}: {
  year: number;
  carryForward: number;
}) {
  const [state, formAction, pending] = useActionState(
    saveTaxAdjustmentAction,
    adjustmentInitial,
  );

  return (
    <form
      action={formAction}
      className="mt-4 flex flex-wrap items-end gap-3 border-t border-black/[.06] pt-4 dark:border-white/[.08]"
    >
      <input type="hidden" name="year" value={year} />
      <label className={`${ui.label} w-56`}>
        Moins-values reportables {year} (€)
        <input
          name="carryForwardLoss"
          type="number"
          step="any"
          min="0"
          defaultValue={carryForward || ""}
          placeholder="0"
          className={ui.input}
        />
        <span className="text-xs font-normal text-zinc-400">
          Pertes des années précédentes encore imputables.
        </span>
      </label>
      <button type="submit" disabled={pending} className={ui.secondaryButton}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
      {state.ok ? (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          Enregistré.
        </span>
      ) : null}
      {state.error ? (
        <span className="text-xs text-red-600 dark:text-red-400">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

"use client";

import { useActionState, useMemo, useState } from "react";
import {
  saveTaxAdjustmentAction,
  type TaxAdjustmentState,
} from "@/app/(app)/fiscalite/actions";
import type { FiscalSale, FiscalIncome } from "@/lib/fiscalite";
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
  adjustments: { year: number; carryForwardLoss: number }[];
};

const adjustmentInitial: TaxAdjustmentState = {};

function csvField(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function FiscaliteView({ sales, income, adjustments }: Props) {
  const availableYears = useMemo(
    () =>
      [
        ...new Set([
          ...sales.map((sale) => new Date(sale.executedAt).getFullYear()),
          ...income.map((entry) =>
            new Date(entry.receivedAt).getFullYear(),
          ),
        ]),
      ].sort((a, b) => b - a),
    [sales, income],
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
      const wallet = getWallet(sale.walletId, sale.walletName);
      wallet.realizedGain += sale.realizedGain;
      wallet.count += 1;
      // Each sale is taxed at its own rate (PEA 5-year rule).
      wallet.estimatedTax += Math.max(0, sale.realizedGain) * sale.taxRate;
      wallet.rates.add(sale.taxRate);

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
      wallet.estimatedTax += Math.max(0, entry.net) * entry.taxRate;
      wallet.rates.add(entry.taxRate);
    }

    const wallets = [...perWallet.values()].sort(
      (a, b) =>
        b.realizedGain + b.income - (a.realizedGain + a.income),
    );
    const assets = [...perAsset.values()].sort(
      (a, b) => b.realizedGain - a.realizedGain,
    );

    // Carry-forward losses reduce taxable gains, distributed proportionally
    // across each positive-gain sale (taxed at its own rate). Income is taxed
    // separately at its own rate, without carry-forward.
    const totalPositiveGain = filtered.reduce(
      (sum, sale) => sum + Math.max(0, sale.realizedGain),
      0,
    );
    let estimatedTax = 0;
    for (const sale of filtered) {
      const positive = Math.max(0, sale.realizedGain);
      const share =
        totalPositiveGain > 0
          ? carryForward * (positive / totalPositiveGain)
          : 0;
      estimatedTax += Math.max(0, sale.realizedGain - share) * sale.taxRate;
    }
    for (const entry of filteredIncome) {
      estimatedTax += Math.max(0, entry.net) * entry.taxRate;
    }

    return {
      wallets,
      assets,
      netRealized,
      totalIncome,
      netTaxable: Math.max(0, netRealized - carryForward),
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
              {filtered.length === 1 ? "" : "s"})
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
          Estimation indicative. La fiscalité réelle dépend de règles que
          l&apos;application ne connaît pas (durée de détention, abattements,
          régime du PEA…). Ajustez le taux d&apos;imposition sur chaque wallet
          et les moins-values reportables ci-dessus.
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
                      {wallet.rates.size === 1
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

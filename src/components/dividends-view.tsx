"use client";

import { useMemo, useState } from "react";
import { deleteDividendAction } from "@/app/(app)/dividendes/actions";
import { DeleteButton } from "@/components/delete-button";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { ui } from "@/lib/ui";

export type DividendRow = {
  id: string;
  source: string;
  receivedAt: string;
  grossAmount: number;
  withheldTax: number;
  currency: string;
  taxRate: number | null;
  notes: string | null;
  wallet: { id: string; name: string; type: string } | null;
  asset: { id: string; name: string; symbol: string } | null;
};

function csvField(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function DividendsView({ dividends }: { dividends: DividendRow[] }) {
  const availableYears = useMemo(
    () =>
      [
        ...new Set(
          dividends.map((d) => new Date(d.receivedAt).getFullYear()),
        ),
      ].sort((a, b) => b - a),
    [dividends],
  );

  const currentYear = new Date().getFullYear();
  const defaultYear =
    availableYears.find((year) => year < currentYear) ??
    availableYears[0] ??
    currentYear;

  const [year, setYear] = useState<number | "all">(defaultYear);

  const filtered = useMemo(() => {
    if (year === "all") return dividends;
    return dividends.filter(
      (d) => new Date(d.receivedAt).getFullYear() === year,
    );
  }, [dividends, year]);

  const stats = useMemo(() => {
    const totalsByCurrency = new Map<string, { gross: number; tax: number }>();
    const perAsset = new Map<
      string,
      { label: string; gross: number; currency: string; count: number }
    >();
    const perWallet = new Map<
      string,
      { name: string; gross: number; currency: string; count: number }
    >();
    const perYear = new Map<number, Map<string, number>>(); // year -> currency -> gross

    for (const dividend of filtered) {
      const totals = totalsByCurrency.get(dividend.currency) ?? {
        gross: 0,
        tax: 0,
      };
      totals.gross += dividend.grossAmount;
      totals.tax += dividend.withheldTax;
      totalsByCurrency.set(dividend.currency, totals);

      const assetKey = dividend.asset?.id ?? `__src:${dividend.source}`;
      const assetLabel = dividend.asset
        ? `${dividend.asset.name} (${dividend.asset.symbol})`
        : dividend.source;
      const assetTotals = perAsset.get(assetKey) ?? {
        label: assetLabel,
        gross: 0,
        currency: dividend.currency,
        count: 0,
      };
      assetTotals.gross += dividend.grossAmount;
      assetTotals.count += 1;
      perAsset.set(assetKey, assetTotals);

      const walletKey = dividend.wallet?.id ?? "__none";
      const walletName = dividend.wallet?.name ?? "Sans wallet";
      const walletTotals = perWallet.get(walletKey) ?? {
        name: walletName,
        gross: 0,
        currency: dividend.currency,
        count: 0,
      };
      walletTotals.gross += dividend.grossAmount;
      walletTotals.count += 1;
      perWallet.set(walletKey, walletTotals);
    }

    for (const dividend of dividends) {
      const y = new Date(dividend.receivedAt).getFullYear();
      const yearTotals = perYear.get(y) ?? new Map<string, number>();
      yearTotals.set(
        dividend.currency,
        (yearTotals.get(dividend.currency) ?? 0) + dividend.grossAmount,
      );
      perYear.set(y, yearTotals);
    }

    return {
      totalsByCurrency: [...totalsByCurrency.entries()],
      assets: [...perAsset.values()].sort((a, b) => b.gross - a.gross),
      wallets: [...perWallet.values()].sort((a, b) => b.gross - a.gross),
      years: [...perYear.entries()].sort((a, b) => b[0] - a[0]),
    };
  }, [filtered, dividends]);

  function exportCsv() {
    const header = [
      "Date",
      "Source",
      "Asset",
      "Wallet",
      "Montant brut",
      "Devise",
      "Impôt prélevé",
      "Taux",
      "Note",
    ]
      .map(csvField)
      .join(",");
    const rows = filtered.map((d) =>
      [
        formatDate(d.receivedAt),
        d.source,
        d.asset ? `${d.asset.name} (${d.asset.symbol})` : "",
        d.wallet?.name ?? "",
        d.grossAmount.toFixed(2),
        d.currency,
        d.withheldTax.toFixed(2),
        d.taxRate != null ? d.taxRate.toString() : "",
        d.notes ?? "",
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
    link.download = `dividendes-${year === "all" ? "tous" : year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (dividends.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
        Aucun dividende enregistré pour le moment.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Year selector */}
      <div className="flex flex-wrap items-center gap-2">
        {availableYears.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setYear(option)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              year === option
                ? "bg-emerald-600 text-white"
                : "border border-black/[.12] text-zinc-600 hover:bg-zinc-100 dark:border-white/[.16] dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            {option}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setYear("all")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            year === "all"
              ? "bg-emerald-600 text-white"
              : "border border-black/[.12] text-zinc-600 hover:bg-zinc-100 dark:border-white/[.16] dark:text-zinc-400 dark:hover:bg-zinc-900"
          }`}
        >
          Tous
        </button>
      </div>

      {/* Annual totals */}
      <div className="rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.12] dark:bg-zinc-950">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
          Total {year === "all" ? "(toutes années)" : year}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-x-10 gap-y-4">
          {stats.totalsByCurrency.length === 0 ? (
            <p className={ui.subtle}>Aucun dividende sur cette période.</p>
          ) : (
            stats.totalsByCurrency.map(([currency, totals]) => (
              <div key={currency}>
                <p className="text-2xl font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                  {formatCurrency(totals.gross, currency)}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Brut perçu ({filtered.length} versement
                  {filtered.length === 1 ? "" : "s"})
                </p>
                {totals.tax > 0 ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Dont prélevé à la source :{" "}
                    {formatCurrency(totals.tax, currency)}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {/* History by year — always visible */}
      {stats.years.length > 1 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Historique par année
          </h2>
          <div className={`${ui.card} overflow-x-auto p-0`}>
            <table className="w-full min-w-[20rem] text-sm">
              <thead>
                <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
                  <th className="px-4 py-3 font-medium">Année</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Total brut
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.years.map(([y, byCurrency]) => (
                  <tr
                    key={y}
                    className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                  >
                    <td className="px-4 py-3 font-medium text-black dark:text-zinc-50">
                      <button
                        type="button"
                        onClick={() => setYear(y)}
                        className="hover:underline"
                      >
                        {y}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {[...byCurrency.entries()]
                        .map(([currency, gross]) =>
                          formatCurrency(gross, currency),
                        )
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Per asset */}
      {stats.assets.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Par source / asset
          </h2>
          <div className={`${ui.card} overflow-x-auto p-0`}>
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Versements
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    Total brut
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.assets.map((asset) => (
                  <tr
                    key={asset.label}
                    className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                  >
                    <td className="px-4 py-3 font-medium text-black dark:text-zinc-50">
                      {asset.label}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                      {asset.count}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(asset.gross, asset.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Detail list */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Détail
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
          <p className={ui.subtle}>Aucun dividende sur cette période.</p>
        ) : (
          <div className={`${ui.card} overflow-x-auto p-0`}>
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Wallet</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Montant brut
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    Prélevé source
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Taux</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((dividend) => (
                  <tr
                    key={dividend.id}
                    className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {formatDate(dividend.receivedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-black dark:text-zinc-50">
                        {dividend.source}
                      </span>
                      {dividend.asset ? (
                        <span className="ml-2 font-mono text-xs text-zinc-400">
                          {dividend.asset.symbol}
                        </span>
                      ) : null}
                      {dividend.notes ? (
                        <span className="mt-0.5 block text-xs text-zinc-400">
                          {dividend.notes}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {dividend.wallet?.name ?? (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(dividend.grossAmount, dividend.currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                      {dividend.withheldTax > 0
                        ? formatCurrency(
                            dividend.withheldTax,
                            dividend.currency,
                          )
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                      {dividend.taxRate != null
                        ? formatPercent(dividend.taxRate)
                        : "auto"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteButton
                        action={deleteDividendAction}
                        id={dividend.id}
                        label="Suppr."
                        confirmMessage="Supprimer ce dividende ?"
                      />
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

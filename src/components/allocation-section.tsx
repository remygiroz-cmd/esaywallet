"use client";

import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { WalletComputation, AssetComputation } from "@/lib/portfolio";
import { ASSET_TYPE_LABELS, type AssetType } from "@/lib/constants";
import { formatCurrency, formatPercent } from "@/lib/format";
import { ui } from "@/lib/ui";

type Slice = { name: string; value: number };
type Mode = "class" | "wallet" | "asset";

const COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#ec4899",
  "#f97316",
  "#6366f1",
  "#84cc16",
];

const MODE_LABELS: Record<Mode, string> = {
  class: "Par classe",
  wallet: "Par wallet",
  asset: "Par asset",
};

export function AllocationSection({
  wallets,
  assets,
  referenceCurrency,
}: {
  wallets: WalletComputation[];
  assets: AssetComputation[];
  referenceCurrency: string;
}) {
  const [mode, setMode] = useState<Mode>("class");

  const slices = useMemo<Slice[]>(() => {
    if (mode === "wallet") {
      return wallets
        .map((wallet) => ({
          name: wallet.name,
          value: wallet.currentValueReference,
        }))
        .filter((slice) => slice.value > 0);
    }
    if (mode === "asset") {
      return assets
        .map((asset) => ({ name: asset.name, value: asset.currentValue }))
        .filter((slice) => slice.value > 0)
        .sort((a, b) => b.value - a.value);
    }
    const byClass = new Map<string, number>();
    for (const asset of assets) {
      byClass.set(
        asset.type,
        (byClass.get(asset.type) ?? 0) + asset.currentValue,
      );
    }
    return [...byClass.entries()]
      .map(([type, value]) => ({
        name: ASSET_TYPE_LABELS[type as AssetType] ?? type,
        value,
      }))
      .filter((slice) => slice.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [mode, wallets, assets]);

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Répartition
        </h2>
        <div className="flex gap-1">
          {(Object.keys(MODE_LABELS) as Mode[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === option
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {MODE_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      {slices.length === 0 || total <= 0 ? (
        <div className={`${ui.card} text-center text-sm text-zinc-400`}>
          Pas encore de données à répartir.
        </div>
      ) : (
        <div className={`${ui.card} flex flex-col gap-4 sm:flex-row sm:items-center`}>
          <div className="h-52 w-full sm:w-52 sm:shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {slices.map((slice, index) => (
                    <Cell
                      key={slice.name}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="flex flex-1 flex-col gap-1.5">
            {slices.map((slice, index) => (
              <li
                key={slice.name}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="truncate text-zinc-700 dark:text-zinc-200">
                    {slice.name}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
                  {formatCurrency(slice.value, referenceCurrency)}
                  <span className="ml-2 text-zinc-400">
                    {formatPercent(slice.value / total).replace("+", "")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

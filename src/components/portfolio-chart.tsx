"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PortfolioSnapshotPoint } from "@/lib/portfolio";
import { formatCurrency, formatDate } from "@/lib/format";
import { ui } from "@/lib/ui";

type PortfolioChartProps = {
  history: PortfolioSnapshotPoint[];
  currency: string;
};

type TooltipItem = { dataKey?: string | number; value?: number | string };

type ChartTooltipProps = {
  currency: string;
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
};

function ChartTooltip({ currency, active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const value = payload.find((item) => item.dataKey === "valeur")?.value;
  const invested = payload.find((item) => item.dataKey === "investi")?.value;

  return (
    <div className="rounded-lg border border-black/[.1] bg-white px-3 py-2 text-xs shadow-sm dark:border-white/[.15] dark:bg-zinc-900">
      <p className="font-medium text-zinc-500 dark:text-zinc-400">
        {label ? formatDate(label) : ""}
      </p>
      {typeof value === "number" ? (
        <p className="mt-1 font-semibold text-emerald-600 dark:text-emerald-400">
          Valeur : {formatCurrency(value, currency)}
        </p>
      ) : null}
      {typeof invested === "number" ? (
        <p className="text-zinc-600 dark:text-zinc-300">
          Investi : {formatCurrency(invested, currency)}
        </p>
      ) : null}
    </div>
  );
}

const compactFormatter = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function PortfolioChart({ history, currency }: PortfolioChartProps) {
  if (history.length < 2) {
    return (
      <div
        className={`${ui.card} text-center text-sm text-zinc-500 dark:text-zinc-400`}
      >
        L&apos;historique de votre portefeuille se construira jour après
        jour, à chaque consultation du tableau de bord.
      </div>
    );
  }

  const data = history.map((point) => ({
    date: point.date,
    valeur: point.totalValue,
    investi: point.totalInvested,
  }));

  return (
    <div className={ui.card}>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
          >
            <defs>
              <linearGradient id="ew-value-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#71717a"
              strokeOpacity={0.2}
            />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatDate(value)}
              tick={{ fontSize: 11, fill: "#71717a" }}
              tickLine={false}
              axisLine={{ stroke: "#71717a", strokeOpacity: 0.3 }}
              minTickGap={32}
            />
            <YAxis
              tickFormatter={(value) => compactFormatter.format(value)}
              tick={{ fontSize: 11, fill: "#71717a" }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip content={<ChartTooltip currency={currency} />} />
            <Area
              type="monotone"
              dataKey="valeur"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#ew-value-fill)"
            />
            <Line
              type="monotone"
              dataKey="investi"
              stroke="#a1a1aa"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-emerald-500" />
          Valeur du portefeuille
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 bg-zinc-400" />
          Montant investi
        </span>
      </div>
    </div>
  );
}

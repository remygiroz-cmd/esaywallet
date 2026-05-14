"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/format";

const RANGES = [
  { key: "1H", label: "1H" },
  { key: "1J", label: "1J" },
  { key: "1S", label: "1S" },
  { key: "1M", label: "1M" },
  { key: "1A", label: "1A" },
  { key: "MAX", label: "Max" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

type HistoryPoint = { t: number; price: number };
type HistoryResponse = {
  history: { currency: string; points: HistoryPoint[] } | null;
  range: string;
};

async function fetchHistory(
  assetId: string,
  range: string,
): Promise<HistoryResponse> {
  const res = await fetch(`/api/assets/${assetId}/history?range=${range}`);
  if (!res.ok) throw new Error("Échec du chargement du graphique");
  return res.json();
}

function formatTick(value: number, range: RangeKey): string {
  const date = new Date(value);
  if (range === "1H" || range === "1J") {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (range === "1S" || range === "1M") {
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
  }
  return date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

const compactFormatter = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 2,
});

type TooltipItem = { value?: number | string };
type ChartTooltipProps = {
  currency: string;
  active?: boolean;
  payload?: TooltipItem[];
  label?: number | string;
};

function ChartTooltip({ currency, active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0]?.value;
  return (
    <div className="rounded-lg border border-black/[.1] bg-white px-3 py-2 text-xs shadow-sm dark:border-white/[.15] dark:bg-zinc-900">
      <p className="text-zinc-500 dark:text-zinc-400">
        {label
          ? new Date(Number(label)).toLocaleString("fr-FR", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : ""}
      </p>
      {typeof value === "number" ? (
        <p className="mt-0.5 font-semibold text-black dark:text-zinc-50">
          {formatCurrency(value, currency)}
        </p>
      ) : null}
    </div>
  );
}

export function AssetPriceChart({
  assetId,
  breakEven,
  breakEvenCurrency,
}: {
  assetId: string;
  breakEven?: number;
  breakEvenCurrency?: string;
}) {
  const [range, setRange] = useState<RangeKey>("1J");

  const { data, isFetching, isError } = useQuery({
    queryKey: ["asset-history", assetId, range],
    queryFn: () => fetchHistory(assetId, range),
    staleTime: 60_000,
  });

  const history = data?.history ?? null;
  const points = history?.points ?? [];
  const currency = history?.currency ?? "EUR";

  // The break-even line is only meaningful when expressed in the same
  // currency as the chart.
  const showBreakEven =
    typeof breakEven === "number" &&
    breakEven > 0 &&
    breakEvenCurrency === currency;

  const first = points[0]?.price;
  const last = points[points.length - 1]?.price;
  const up = first === undefined || last === undefined ? true : last >= first;
  const color = up ? "#10b981" : "#ef4444";
  const gradientId = `price-grad-${assetId}`;

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {RANGES.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setRange(option.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              range === option.key
                ? "bg-emerald-600 text-white"
                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-2 h-56 w-full">
        {points.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-400">
            {isFetching
              ? "Chargement du cours…"
              : isError || data?.history === null
                ? "Cours momentanément indisponible — réessaie dans un instant."
                : "Aucune donnée pour cette période."}
          </div>
        ) : (
          <ResponsiveContainer>
            <AreaChart
              data={points}
              margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                tickFormatter={(value) => formatTick(Number(value), range)}
                tick={{ fontSize: 10, fill: "#71717a" }}
                tickLine={false}
                axisLine={{ stroke: "#71717a", strokeOpacity: 0.3 }}
                minTickGap={40}
              />
              <YAxis
                dataKey="price"
                domain={["auto", "auto"]}
                tickFormatter={(value) =>
                  compactFormatter.format(Number(value))
                }
                tick={{ fontSize: 10, fill: "#71717a" }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip content={<ChartTooltip currency={currency} />} />
              {showBreakEven ? (
                <ReferenceLine
                  y={breakEven}
                  stroke="#f59e0b"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Seuil ${formatCurrency(
                      breakEven as number,
                      currency,
                    )}`,
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "#f59e0b",
                  }}
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="price"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

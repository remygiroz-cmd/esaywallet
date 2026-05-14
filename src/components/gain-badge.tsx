import { formatSignedCurrency, formatPercent } from "@/lib/format";

type GainBadgeProps = {
  gain: number;
  gainPct: number;
  currency: string;
  size?: "sm" | "md" | "lg";
};

export function GainBadge({
  gain,
  gainPct,
  currency,
  size = "md",
}: GainBadgeProps) {
  const positive = gain >= 0;
  const color = positive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
  const sizeClass =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base";

  return (
    <span className={`${color} ${sizeClass} font-semibold tabular-nums`}>
      {formatSignedCurrency(gain, currency)}
      <span className="ml-1.5 text-xs font-medium opacity-80">
        ({formatPercent(gainPct)})
      </span>
    </span>
  );
}

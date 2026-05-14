import "server-only";

// Timeframes offered by the price chart, à la Trade Republic.
export type HistoryRange = "1H" | "1J" | "1S" | "1M" | "1A" | "MAX";

export const HISTORY_RANGES: HistoryRange[] = [
  "1H",
  "1J",
  "1S",
  "1M",
  "1A",
  "MAX",
];

export type HistoryPoint = { t: number; price: number };

export type AssetHistory = {
  currency: string;
  points: HistoryPoint[];
};

const COINGECKO_DAYS: Record<HistoryRange, string> = {
  "1H": "1",
  "1J": "1",
  "1S": "7",
  "1M": "30",
  "1A": "365",
  MAX: "max",
};

const YAHOO_PARAMS: Record<HistoryRange, { range: string; interval: string }> =
  {
    "1H": { range: "1d", interval: "2m" },
    "1J": { range: "1d", interval: "5m" },
    "1S": { range: "5d", interval: "30m" },
    "1M": { range: "1mo", interval: "1d" },
    "1A": { range: "1y", interval: "1d" },
    MAX: { range: "max", interval: "1wk" },
  };

// The free APIs don't expose a 1-hour window directly, so it's sliced from
// the intraday series.
function lastHour(points: HistoryPoint[]): HistoryPoint[] {
  const cutoff = Date.now() - 60 * 60 * 1000;
  const recent = points.filter((point) => point.t >= cutoff);
  return recent.length > 1 ? recent : points.slice(-12);
}

async function fetchCryptoHistory(
  coingeckoId: string,
  range: HistoryRange,
): Promise<AssetHistory | null> {
  const params = new URLSearchParams({
    vs_currency: "eur",
    days: COINGECKO_DAYS[range],
  });
  const headers: Record<string, string> = { accept: "application/json" };
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }

  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
      coingeckoId,
    )}/market_chart?${params}`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) return null;

  const data = (await res.json()) as { prices?: [number, number][] };
  let points: HistoryPoint[] = (data.prices ?? []).map(([t, price]) => ({
    t,
    price,
  }));
  if (range === "1H") points = lastHour(points);
  return { currency: "EUR", points };
}

async function fetchStockHistory(
  yahooSymbol: string,
  range: HistoryRange,
): Promise<AssetHistory | null> {
  const { range: yahooRange, interval } = YAHOO_PARAMS[range];

  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooSymbol,
    )}?range=${yahooRange}&interval=${interval}`,
    {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; easyWallet/1.0)",
        accept: "application/json",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        meta?: { currency?: string };
        indicators?: { quote?: Array<{ close?: (number | null)[] }> };
      }>;
    };
  };
  const result = data.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const closes = result?.indicators?.quote?.[0]?.close;
  if (!timestamps || !closes) return null;

  const points: HistoryPoint[] = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const close = closes[i];
    if (typeof close === "number") {
      points.push({ t: timestamps[i] * 1000, price: close });
    }
  }

  return {
    currency: result?.meta?.currency?.toUpperCase() ?? "USD",
    points: range === "1H" ? lastHour(points) : points,
  };
}

export async function fetchAssetHistory(
  asset: {
    type: string;
    coingeckoId: string | null;
    yahooSymbol: string | null;
  },
  range: HistoryRange,
): Promise<AssetHistory | null> {
  try {
    if (asset.type === "CRYPTO" && asset.coingeckoId) {
      return await fetchCryptoHistory(asset.coingeckoId, range);
    }
    if (asset.type !== "CRYPTO" && asset.yahooSymbol) {
      return await fetchStockHistory(asset.yahooSymbol, range);
    }
  } catch {
    return null;
  }
  return null;
}

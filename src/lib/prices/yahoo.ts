import "server-only";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        currency?: string;
        previousClose?: number;
        chartPreviousClose?: number;
      };
    }>;
  };
};

export type StockQuote = {
  price: number;
  currency: string;
  // 24h change as a percentage, or null when the previous close is unknown.
  change24h: number | null;
};

// Yahoo's chart endpoint is the most reliable keyless source for equities
// and ETFs. There is no dependable batch endpoint, so callers fetch per
// symbol — fine for the handful of assets a personal portfolio holds.
export async function fetchStockPrice(
  symbol: string,
): Promise<StockQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=1d&range=1d`;

  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; easyWallet/1.0)",
      accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as YahooChartResponse;
  const meta = data.chart?.result?.[0]?.meta;
  if (
    !meta ||
    typeof meta.regularMarketPrice !== "number" ||
    !meta.currency
  ) {
    return null;
  }

  const previousClose = meta.previousClose ?? meta.chartPreviousClose;
  const change24h =
    typeof previousClose === "number" && previousClose > 0
      ? ((meta.regularMarketPrice - previousClose) / previousClose) * 100
      : null;

  return {
    price: meta.regularMarketPrice,
    currency: meta.currency.toUpperCase(),
    change24h,
  };
}

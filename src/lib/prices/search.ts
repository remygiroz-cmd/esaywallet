import "server-only";

// Unified shape returned by the asset search — ready to fill the asset form.
export type AssetSearchResult = {
  source: "coingecko" | "yahoo";
  name: string;
  symbol: string;
  type: "STOCK" | "ETF" | "CRYPTO";
  quoteCurrency: string;
  coingeckoId: string | null;
  yahooSymbol: string | null;
  hint: string;
};

async function searchCoinGecko(query: string): Promise<AssetSearchResult[]> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }

  const res = await fetch(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    coins?: { id: string; name: string; symbol: string }[];
  };
  return (data.coins ?? []).slice(0, 6).map((coin) => ({
    source: "coingecko" as const,
    name: coin.name,
    symbol: coin.symbol.toUpperCase(),
    type: "CRYPTO" as const,
    quoteCurrency: "EUR",
    coingeckoId: coin.id,
    yahooSymbol: null,
    hint: "Cryptomonnaie",
  }));
}

// Yahoo search returns no currency, so it is inferred from the market suffix.
const EXCHANGE_CURRENCY: Record<string, string> = {
  PA: "EUR",
  AS: "EUR",
  BR: "EUR",
  DE: "EUR",
  F: "EUR",
  MI: "EUR",
  MC: "EUR",
  LS: "EUR",
  VI: "EUR",
  L: "GBP",
  SW: "CHF",
};

function guessCurrency(symbol: string): string {
  const suffix = symbol.includes(".")
    ? (symbol.split(".").pop() ?? "").toUpperCase()
    : "";
  return EXCHANGE_CURRENCY[suffix] ?? "USD";
}

async function searchYahoo(query: string): Promise<AssetSearchResult[]> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      query,
    )}&quotesCount=10&newsCount=0`,
    {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; easyWallet/1.0)",
        accept: "application/json",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) return [];

  const data = (await res.json()) as {
    quotes?: {
      symbol?: string;
      shortname?: string;
      longname?: string;
      quoteType?: string;
      exchDisp?: string;
    }[];
  };

  const results: AssetSearchResult[] = [];
  for (const quote of data.quotes ?? []) {
    if (!quote.symbol) continue;
    if (quote.quoteType !== "EQUITY" && quote.quoteType !== "ETF") continue;
    const type = quote.quoteType === "ETF" ? "ETF" : "STOCK";
    results.push({
      source: "yahoo",
      name: quote.shortname || quote.longname || quote.symbol,
      symbol: quote.symbol.toUpperCase(),
      type,
      quoteCurrency: guessCurrency(quote.symbol),
      coingeckoId: null,
      yahooSymbol: quote.symbol,
      hint: `${type === "ETF" ? "ETF" : "Action"}${
        quote.exchDisp ? ` · ${quote.exchDisp}` : ""
      }`,
    });
    if (results.length >= 6) break;
  }
  return results;
}

// Queries both providers; a failure on one side never breaks the other.
export async function searchAssets(
  query: string,
): Promise<AssetSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const [stocks, crypto] = await Promise.all([
    searchYahoo(trimmed).catch(() => []),
    searchCoinGecko(trimmed).catch(() => []),
  ]);
  return [...stocks, ...crypto].slice(0, 12);
}

// Resolves any identifier (ticker, ISIN or crypto symbol) to a fully
// populated asset, picking the right price provider. Used by the universal
// importer, where the kind of asset isn't known upfront.
export type ResolvedAsset = {
  symbol: string;
  name: string;
  type: "STOCK" | "ETF" | "CRYPTO";
  quoteCurrency: string;
  coingeckoId: string | null;
  yahooSymbol: string | null;
};

export async function resolveGenericAsset(
  rawSymbol: string,
  kind: "auto" | "crypto" | "equity",
  classHint: "STOCK" | "ETF" | "CRYPTO" | null,
  fallbackName: string,
  fallbackCurrency: string,
): Promise<ResolvedAsset> {
  const wantsCrypto =
    kind === "crypto" || (kind === "auto" && classHint === "CRYPTO");
  const wantsEquity =
    kind === "equity" ||
    (kind === "auto" && (classHint === "STOCK" || classHint === "ETF"));

  if (wantsCrypto) {
    const coin = await resolveCoingeckoId(rawSymbol).catch(() => null);
    return {
      symbol: rawSymbol.toUpperCase(),
      name: coin?.name ?? fallbackName,
      type: "CRYPTO",
      quoteCurrency: "EUR",
      coingeckoId: coin?.id ?? null,
      yahooSymbol: null,
    };
  }

  if (wantsEquity) {
    const quote = await resolveYahooSymbol(rawSymbol).catch(() => null);
    return {
      symbol: quote?.symbol ?? rawSymbol.toUpperCase(),
      name: quote?.name ?? fallbackName,
      type: classHint === "ETF" ? "ETF" : "STOCK",
      quoteCurrency: fallbackCurrency || "EUR",
      coingeckoId: null,
      yahooSymbol: quote?.symbol ?? null,
    };
  }

  // Auto with no hint: an ISIN/ticker resolves on Yahoo, otherwise try
  // CoinGecko for crypto tickers.
  const quote = await resolveYahooSymbol(rawSymbol).catch(() => null);
  if (quote) {
    return {
      symbol: quote.symbol,
      name: quote.name,
      type: "STOCK",
      quoteCurrency: fallbackCurrency || "EUR",
      coingeckoId: null,
      yahooSymbol: quote.symbol,
    };
  }
  const coin = await resolveCoingeckoId(rawSymbol).catch(() => null);
  if (coin) {
    return {
      symbol: rawSymbol.toUpperCase(),
      name: coin.name,
      type: "CRYPTO",
      quoteCurrency: "EUR",
      coingeckoId: coin.id,
      yahooSymbol: null,
    };
  }

  return {
    symbol: rawSymbol.toUpperCase(),
    name: fallbackName,
    type: "STOCK",
    quoteCurrency: fallbackCurrency || "EUR",
    coingeckoId: null,
    yahooSymbol: null,
  };
}
export async function resolveYahooSymbol(
  query: string,
): Promise<{ symbol: string; name: string } | null> {
  const results = await searchYahoo(query).catch(() => []);
  const first = results[0];
  if (!first || !first.yahooSymbol) return null;
  return { symbol: first.yahooSymbol, name: first.name };
}

// Resolves a crypto symbol (e.g. "BTC") to its CoinGecko id, used when
// importing a file that only carries ticker symbols. CoinGecko ranks
// search results by relevance, so the first symbol match is the main coin.
export async function resolveCoingeckoId(
  symbol: string,
): Promise<{ id: string; name: string } | null> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }

  const res = await fetch(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(
      symbol,
    )}`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    coins?: { id: string; name: string; symbol: string }[];
  };
  const coins = data.coins ?? [];
  const exact = coins.find(
    (coin) => coin.symbol.toUpperCase() === symbol.toUpperCase(),
  );
  const chosen = exact ?? coins[0];
  return chosen ? { id: chosen.id, name: chosen.name } : null;
}

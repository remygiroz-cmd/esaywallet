import "server-only";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// For a CoinGecko id: the price in each requested currency, and the 24h
// change (as a percentage) in each currency.
export type CryptoQuote = {
  prices: Record<string, number>;
  changes: Record<string, number>;
};
export type CryptoPriceMap = Map<string, CryptoQuote>;

// Batched price lookup — one request covers every crypto the user holds.
export async function fetchCryptoPrices(
  ids: string[],
  currencies: string[],
): Promise<CryptoPriceMap> {
  const result: CryptoPriceMap = new Map();
  if (ids.length === 0) return result;

  const params = new URLSearchParams({
    ids: ids.join(","),
    vs_currencies: currencies.map((c) => c.toLowerCase()).join(","),
    include_24hr_change: "true",
  });

  const headers: Record<string, string> = { accept: "application/json" };
  // Optional demo API key raises the free rate limit.
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }

  const res = await fetch(`${COINGECKO_BASE}/simple/price?${params}`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`CoinGecko a répondu ${res.status}`);
  }

  const data = (await res.json()) as Record<string, Record<string, number>>;
  for (const [id, entry] of Object.entries(data)) {
    const prices: Record<string, number> = {};
    const changes: Record<string, number> = {};
    for (const [key, value] of Object.entries(entry)) {
      if (key.endsWith("_24h_change")) {
        changes[key.replace("_24h_change", "").toUpperCase()] = value;
      } else {
        prices[key.toUpperCase()] = value;
      }
    }
    result.set(id, { prices, changes });
  }
  return result;
}

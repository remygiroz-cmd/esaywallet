import "server-only";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// Maps a CoinGecko id to its price in each requested currency (upper-cased).
export type CryptoPriceMap = Map<string, Record<string, number>>;

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
  for (const [id, prices] of Object.entries(data)) {
    const normalized: Record<string, number> = {};
    for (const [currency, value] of Object.entries(prices)) {
      normalized[currency.toUpperCase()] = value;
    }
    result.set(id, normalized);
  }
  return result;
}

// Currency conversion helpers (pure — usable on server and client).
//
// All FX rates are stored as EUR -> quote. Any cross rate is derived from
// those: amount(from -> to) = amount / eurRate(from) * eurRate(to).

export type FxRateMap = Map<string, number>;

export function buildFxRateMap(
  rates: { quote: string; rate: number }[],
): FxRateMap {
  const map: FxRateMap = new Map();
  for (const { quote, rate } of rates) {
    map.set(quote, rate);
  }
  return map;
}

function eurRate(currency: string, rates: FxRateMap): number | null {
  if (currency === "EUR") return 1;
  return rates.get(currency) ?? null;
}

// Returns null when a rate is missing so callers can flag the value as
// "unavailable" rather than silently showing a wrong number.
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: FxRateMap,
): number | null {
  if (from === to) return amount;
  const fromRate = eurRate(from, rates);
  const toRate = eurRate(to, rates);
  if (fromRate === null || toRate === null) return null;
  return (amount / fromRate) * toRate;
}

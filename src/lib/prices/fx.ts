import "server-only";

const FRANKFURTER_BASE = "https://api.frankfurter.app";

// Returns base -> quote rates (e.g. { USD: 1.08, GBP: 0.85 }).
// Frankfurter is free, keyless and backed by ECB reference rates.
export async function fetchFxRates(
  base: string,
  symbols: string[],
): Promise<Record<string, number>> {
  const targets = symbols.filter((symbol) => symbol !== base);
  if (targets.length === 0) return {};

  const params = new URLSearchParams({
    base,
    symbols: targets.join(","),
  });

  const res = await fetch(`${FRANKFURTER_BASE}/latest?${params}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Frankfurter a répondu ${res.status}`);
  }

  const data = (await res.json()) as { rates?: Record<string, number> };
  return data.rates ?? {};
}

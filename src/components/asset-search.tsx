"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ui } from "@/lib/ui";

export type AssetSearchSelection = {
  name: string;
  symbol: string;
  type: string;
  quoteCurrency: string;
  coingeckoId: string | null;
  yahooSymbol: string | null;
};

type SearchResult = AssetSearchSelection & {
  source: string;
  hint: string;
};

async function fetchResults(query: string): Promise<SearchResult[]> {
  const res = await fetch(
    `/api/assets/search?q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: SearchResult[] };
  return data.results ?? [];
}

export function AssetSearch({
  onSelect,
}: {
  onSelect: (selection: AssetSearchSelection) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["asset-search", debounced],
    queryFn: () => fetchResults(debounced),
    enabled: debounced.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  function handleChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(value), 300);
  }

  function handlePick(result: SearchResult) {
    onSelect({
      name: result.name,
      symbol: result.symbol,
      type: result.type,
      quoteCurrency: result.quoteCurrency,
      coingeckoId: result.coingeckoId,
      yahooSymbol: result.yahooSymbol,
    });
    setQuery("");
    setDebounced("");
    setOpen(false);
  }

  const showDropdown = open && debounced.trim().length >= 2;

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Rechercher un asset (ex. Apple, Bitcoin, MSCI World)…"
        className={ui.input}
      />
      {showDropdown ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-black/[.12] bg-white shadow-lg dark:border-white/[.16] dark:bg-zinc-900">
          {isFetching ? (
            <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
              Recherche…
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
              Aucun résultat — essaie un autre nom.
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {results.map((result, index) => (
                <li key={`${result.source}-${result.symbol}-${index}`}>
                  <button
                    type="button"
                    onClick={() => handlePick(result)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span className="truncate">
                      <span className="font-medium text-black dark:text-zinc-50">
                        {result.name}
                      </span>{" "}
                      <span className="font-mono text-xs text-zinc-400">
                        {result.symbol}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400">
                      {result.hint}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

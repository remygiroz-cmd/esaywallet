"use client";

import { useState } from "react";

// CoinGecko-style brand icons for the common cryptos, served from a
// public CDN. For anything else — stocks, ETFs, unknown tokens — we
// fall back to a coloured letter avatar generated from the symbol so
// the row still has a recognisable mark instead of a blank circle.
const CRYPTO_ICON_BASE =
  "https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@master/svg/color";

const TYPE_PALETTE: Record<string, string[]> = {
  CRYPTO: ["#f59e0b", "#ea580c", "#d97706", "#dc2626", "#a855f7"],
  STOCK: ["#2563eb", "#0ea5e9", "#06b6d4", "#0284c7", "#0d9488"],
  ETF: ["#7c3aed", "#6366f1", "#4f46e5", "#8b5cf6", "#a855f7"],
};

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function colourFor(symbol: string, type: string): string {
  const palette = TYPE_PALETTE[type] ?? ["#52525b", "#3f3f46", "#27272a"];
  return palette[hashCode(symbol) % palette.length];
}

export function AssetIcon({
  symbol,
  type,
  size = 36,
}: {
  symbol: string;
  type: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const cleanSymbol = symbol.replace(/[^a-z0-9]/gi, "").toLowerCase();

  if (type === "CRYPTO" && cleanSymbol && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`${CRYPTO_ICON_BASE}/${cleanSymbol}.svg`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        className="shrink-0 rounded-full bg-white shadow-sm dark:bg-zinc-900"
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = symbol.slice(0, 2).toUpperCase() || "?";
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.36),
        backgroundColor: colourFor(symbol, type),
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

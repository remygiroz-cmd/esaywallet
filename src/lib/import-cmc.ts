// Parser for CoinMarketCap's "transaction history" CSV export.
//
// Header looks like:
//   Date (UTC+2:00),Token,Type,Price (EUR),Amount,Total value (EUR),Fee,Fee Currency,Notes
// Fields are quoted and numbers use the US format ("70,994.98" = 70994.98).
// Pure module — used both client-side (preview) and server-side (import).

import { parseCsvLine, detectDelimiter } from "@/lib/csv";

export type CmcRow = {
  line: number;
  token: string; // symbol, upper-cased
  type: "BUY" | "SELL";
  executedAt: string; // ISO
  unitPrice: number; // EUR
  quantity: number;
  amountInvested: number; // EUR (proceeds for a sell)
  fees: number;
};

export type CmcParseResult = {
  rows: CmcRow[];
  skipped: number;
  tokens: string[];
};

// US-formatted number: comma = thousands separator, dot = decimal.
function parseUsNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const cleaned = raw.trim();
  if (!cleaned || cleaned === "--") return null;
  const value = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function parseCmcDate(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const match = raw
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const date = new Date(
    Date.UTC(
      +match[1],
      +match[2] - 1,
      +match[3],
      +match[4],
      +match[5],
      +match[6],
    ),
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function columnIndex(
  header: string[],
  matcher: (name: string) => boolean,
): number {
  return header.findIndex((name) => matcher(name.trim().toLowerCase()));
}

export function parseCmcCsv(text: string): CmcParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { rows: [], skipped: 0, tokens: [] };

  const delimiter = detectDelimiter(lines[0]);
  const header = parseCsvLine(lines[0], delimiter);
  const idx = {
    date: columnIndex(header, (name) => name.startsWith("date")),
    token: columnIndex(header, (name) => name === "token"),
    type: columnIndex(header, (name) => name === "type"),
    price: columnIndex(header, (name) => name.startsWith("price")),
    amount: columnIndex(header, (name) => name === "amount"),
    total: columnIndex(header, (name) => name.startsWith("total")),
    fee: columnIndex(header, (name) => name === "fee"),
  };

  const rows: CmcRow[] = [];
  let skipped = 0;
  const tokenSet = new Set<string>();

  for (let i = 1; i < lines.length; i += 1) {
    const fields = parseCsvLine(lines[i], delimiter);
    const token = (fields[idx.token] ?? "").trim().toUpperCase();
    const rawType = (fields[idx.type] ?? "").trim().toLowerCase();
    const executedAt = parseCmcDate(fields[idx.date]);
    const unitPrice = parseUsNumber(fields[idx.price]);
    const quantity = parseUsNumber(fields[idx.amount]);
    const amountInvested = parseUsNumber(fields[idx.total]);

    const type =
      rawType === "buy" ? "BUY" : rawType === "sell" ? "SELL" : null;

    if (
      !token ||
      type === null ||
      executedAt === null ||
      unitPrice === null ||
      quantity === null ||
      amountInvested === null ||
      unitPrice <= 0 ||
      quantity <= 0
    ) {
      skipped += 1;
      continue;
    }

    tokenSet.add(token);
    rows.push({
      line: i + 1,
      token,
      type,
      executedAt,
      unitPrice,
      quantity,
      amountInvested,
      fees: parseUsNumber(fields[idx.fee]) ?? 0,
    });
  }

  return { rows, skipped, tokens: [...tokenSet] };
}

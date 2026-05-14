// Parser for Trade Republic's transaction-history CSV export.
//
// Header columns include:
//   datetime, date, account_type, category, type, asset_class, name,
//   symbol, shares, price, amount, fee, tax, currency, ...
// `symbol` is an ISIN (e.g. US88160R1014), `type` is BUY/SELL, and `shares`
// / `amount` are signed (negative for buys). Numbers use a dot decimal.
// Pure module — used both client-side (preview) and server-side (import).

import { parseCsvLine } from "@/lib/csv";

export type TrRow = {
  line: number;
  isin: string;
  name: string;
  assetType: "STOCK" | "ETF";
  type: "BUY" | "SELL";
  executedAt: string; // ISO
  unitPrice: number;
  quantity: number;
  amountInvested: number; // proceeds for a sell
  fees: number;
  currency: string;
};

export type TrParseResult = {
  rows: TrRow[];
  skipped: number;
  isins: string[];
  classes: ("STOCK" | "ETF")[];
};

function parseTrNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const cleaned = raw.replace(/[\s,]/g, "").trim();
  if (!cleaned || cleaned === "--") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function parseTrDate(
  datetime: string | undefined,
  date: string | undefined,
): string | null {
  if (datetime && datetime.trim()) {
    const parsed = new Date(datetime.trim());
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (date && date.trim()) {
    const match = date.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const parsed = new Date(
        Date.UTC(+match[1], +match[2] - 1, +match[3]),
      );
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }
  return null;
}

function columnIndex(header: string[], name: string): number {
  return header.findIndex((col) => col.trim().toLowerCase() === name);
}

export function parseTrCsv(text: string): TrParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], skipped: 0, isins: [], classes: [] };
  }

  const header = parseCsvLine(lines[0]);
  const idx = {
    datetime: columnIndex(header, "datetime"),
    date: columnIndex(header, "date"),
    type: columnIndex(header, "type"),
    assetClass: columnIndex(header, "asset_class"),
    name: columnIndex(header, "name"),
    symbol: columnIndex(header, "symbol"),
    shares: columnIndex(header, "shares"),
    price: columnIndex(header, "price"),
    amount: columnIndex(header, "amount"),
    fee: columnIndex(header, "fee"),
    currency: columnIndex(header, "currency"),
  };

  const rows: TrRow[] = [];
  let skipped = 0;
  const isinSet = new Set<string>();

  for (let i = 1; i < lines.length; i += 1) {
    const fields = parseCsvLine(lines[i]);
    const isin = (fields[idx.symbol] ?? "").trim().toUpperCase();
    const rawType = (fields[idx.type] ?? "").trim().toUpperCase();
    const executedAt = parseTrDate(fields[idx.datetime], fields[idx.date]);
    const unitPrice = parseTrNumber(fields[idx.price]);
    const quantity = parseTrNumber(fields[idx.shares]);
    const amount = parseTrNumber(fields[idx.amount]);

    const type =
      rawType === "BUY" ? "BUY" : rawType === "SELL" ? "SELL" : null;

    if (
      !isin ||
      type === null ||
      executedAt === null ||
      unitPrice === null ||
      quantity === null ||
      amount === null ||
      unitPrice <= 0 ||
      quantity === 0 ||
      amount === 0
    ) {
      skipped += 1;
      continue;
    }

    const assetClass = (fields[idx.assetClass] ?? "").trim().toUpperCase();
    isinSet.add(isin);
    rows.push({
      line: i + 1,
      isin,
      name: (fields[idx.name] ?? "").trim() || isin,
      assetType: assetClass === "FUND" ? "ETF" : "STOCK",
      type,
      executedAt,
      unitPrice: Math.abs(unitPrice),
      quantity: Math.abs(quantity),
      amountInvested: Math.abs(amount),
      fees: Math.abs(parseTrNumber(fields[idx.fee]) ?? 0),
      currency: (fields[idx.currency] ?? "").trim().toUpperCase() || "EUR",
    });
  }

  const classes = [
    ...new Set(rows.map((row) => row.assetType)),
  ] as ("STOCK" | "ETF")[];
  return { rows, skipped, isins: [...isinSet], classes };
}

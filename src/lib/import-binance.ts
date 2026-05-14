// Parser for Binance's "Transaction History" CSV export.
//
// Header (French or English):
//   Identifiant utilisateur,Durée,Compte,Opération,Jeton,Change,Remarque
//   User_ID,UTC_Time,Account,Operation,Coin,Change,Remark
// Each row is ONE balance-change leg — a single trade spans several rows
// that share (roughly) a timestamp. This parser pairs the legs back into
// buys and sells.
//
// Binance's transaction export carries NO price column, so only legs that
// pair a real crypto against a fiat or stablecoin quote (EUR, USDC, USDT…)
// can be priced. Crypto-to-crypto conversions, deposits and withdrawals
// have no euro/dollar value here and are skipped. USD-pegged stablecoins
// are treated as a USD quote (the app converts USD→EUR with its FX rates).
// Pure module — used both client-side (preview) and server-side (import).

import { parseCsvLine, detectDelimiter } from "@/lib/csv";

export type BinanceRow = {
  line: number;
  token: string; // base symbol, upper-cased
  type: "BUY" | "SELL";
  executedAt: string; // ISO
  unitPrice: number;
  quantity: number;
  amountInvested: number; // proceeds for a sell
  fees: number;
  currency: string; // EUR | USD — the quote currency
};

export type BinanceParseResult = {
  rows: BinanceRow[];
  skipped: number;
  tokens: string[];
};

// USD-pegged stablecoins count as a USD quote; EUR stays EUR.
const QUOTE_CURRENCY: Record<string, string> = {
  EUR: "EUR",
  USD: "USD",
  USDC: "USD",
  USDT: "USD",
  BUSD: "USD",
  DAI: "USD",
  FDUSD: "USD",
  TUSD: "USD",
  USDP: "USD",
};

function quoteCurrencyOf(token: string): string | null {
  return QUOTE_CURRENCY[token.toUpperCase()] ?? null;
}

// Lower-cases, repairs UTF-8→Latin-1 mojibake and strips accents so the
// header matches whatever encoding the export ended up in.
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ã©/g, "e")
    .replace(/ã¨/g, "e")
    .replace(/ãª/g, "e")
    .replace(/ã§/g, "c")
    .replace(/ã´/g, "o")
    .replace(/ã®/g, "i")
    .replace(/ã /g, "a")
    .replace(/ã‰/g, "e")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function parseSigned(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let value = raw.replace(/[\s ]/g, "").trim();
  if (!value || value === "--") return null;
  if (value.includes(",") && !value.includes(".")) {
    value = value.replace(",", ".");
  } else {
    value = value.replace(/,/g, "");
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Handles "2025-03-04 19:08:16" and the Excel-shortened "25-03-04 19:08:16".
function parseBinanceDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  const match = text.match(
    /^(\d{2,4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})/,
  );
  if (match) {
    let year = +match[1];
    if (year < 100) year += 2000;
    const date = new Date(
      Date.UTC(year, +match[2] - 1, +match[3], +match[4], +match[5], +match[6]),
    );
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const native = new Date(text);
  return Number.isNaN(native.getTime()) ? null : native.toISOString();
}

type Leg = {
  line: number;
  executedAt: string;
  op: string; // normalized operation label
  token: string; // upper-cased
  amount: number; // signed
};

function findColumn(
  header: string[],
  test: (name: string) => boolean,
  fallback: number,
): number {
  const index = header.findIndex((name) => test(normalize(name)));
  return index >= 0 ? index : fallback;
}

// Turns a real-crypto leg and a fiat/stablecoin leg into a transaction.
function makeRow(base: Leg, quote: Leg, fees: number): BinanceRow | null {
  const currency = quoteCurrencyOf(quote.token);
  if (currency === null) return null;
  const quantity = Math.abs(base.amount);
  const amountInvested = Math.abs(quote.amount);
  if (quantity <= 0 || amountInvested <= 0) return null;
  const unitPrice = amountInvested / quantity;
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;
  return {
    line: base.line,
    token: base.token.toUpperCase(),
    type: base.amount > 0 ? "BUY" : "SELL",
    executedAt: base.executedAt,
    unitPrice,
    quantity,
    amountInvested,
    fees: fees > 0 ? fees : 0,
    currency,
  };
}

// A two-leg operation (Convert / Buy Crypto With Fiat): one leg must be a
// real crypto, the other a fiat/stablecoin quote.
function rowFromPair(a: Leg, b: Leg): BinanceRow | null {
  const aIsQuote = quoteCurrencyOf(a.token) !== null;
  const bIsQuote = quoteCurrencyOf(b.token) !== null;
  if (aIsQuote && !bIsQuote) return makeRow(b, a, 0);
  if (bIsQuote && !aIsQuote) return makeRow(a, b, 0);
  // Both fiat, or both crypto (a crypto-to-crypto swap) — not priceable.
  return null;
}

export function parseBinanceCsv(text: string): BinanceParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { rows: [], skipped: 0, tokens: [] };

  const delimiter = detectDelimiter(lines[0]);
  const header = parseCsvLine(lines[0], delimiter);
  const idx = {
    date: findColumn(
      header,
      (n) => n.includes("duree") || n.includes("time") || n.includes("date"),
      1,
    ),
    op: findColumn(header, (n) => n.includes("operation"), 3),
    token: findColumn(
      header,
      (n) => n.includes("jeton") || n.includes("coin") || n.includes("token"),
      4,
    ),
    amount: findColumn(
      header,
      (n) => n.includes("change") || n.includes("montant") || n.includes("amount"),
      5,
    ),
  };

  // Parse every leg, bucketed by operation family.
  const convertLegs: Leg[] = [];
  const fiatLegs: Leg[] = [];
  const spotLegs: Leg[] = [];
  const dataLineCount = lines.length - 1;

  for (let i = 1; i < lines.length; i += 1) {
    const fields = parseCsvLine(lines[i], delimiter);
    const executedAt = parseBinanceDate(fields[idx.date]);
    const op = normalize(fields[idx.op] ?? "");
    const token = (fields[idx.token] ?? "").trim().toUpperCase();
    const amount = parseSigned(fields[idx.amount]);
    if (executedAt === null || !op || !token || amount === null || amount === 0) {
      continue;
    }
    const leg: Leg = { line: i + 1, executedAt, op, token, amount };

    if (op.includes("convert")) {
      convertLegs.push(leg);
    } else if (
      op.includes("transaction") &&
      !op.includes("related") &&
      !op.includes("fee only")
    ) {
      spotLegs.push(leg);
    } else if (
      (op.includes("buy") || op.includes("sell")) &&
      (op.includes("fiat") || op.includes("crypto"))
    ) {
      fiatLegs.push(leg);
    }
    // Deposits, withdrawals, earn, distribution, transfers… are dropped.
  }

  const rows: BinanceRow[] = [];
  const consumed = new Set<number>();

  // Convert / Buy-Crypto-With-Fiat: legs come as file-adjacent +/- pairs.
  const pairConsecutive = (legs: Leg[]) => {
    let pending: Leg | null = null;
    for (const leg of legs) {
      if (pending === null) {
        pending = leg;
        continue;
      }
      const oppositeSigns = pending.amount < 0 !== leg.amount < 0;
      const closeInTime =
        Math.abs(
          new Date(leg.executedAt).getTime() -
            new Date(pending.executedAt).getTime(),
        ) < 3_600_000;
      if (oppositeSigns && closeInTime) {
        const row = rowFromPair(pending, leg);
        if (row) {
          rows.push(row);
          consumed.add(pending.line);
          consumed.add(leg.line);
        }
        pending = null;
      } else {
        // The pending leg is an orphan; restart pairing from this one.
        pending = leg;
      }
    }
  };
  pairConsecutive(convertLegs);
  pairConsecutive(fiatLegs);

  // Spot trades: legs of one trade share an exact timestamp. "Buy"/"Sold"
  // legs are the base, "Spend"/"Revenue" the quote, "Fee" the fee.
  const spotByTime = new Map<string, Leg[]>();
  for (const leg of spotLegs) {
    const list = spotByTime.get(leg.executedAt);
    if (list) list.push(leg);
    else spotByTime.set(leg.executedAt, [leg]);
  }
  for (const group of spotByTime.values()) {
    const baseLegs: Leg[] = [];
    const quoteLegs: Leg[] = [];
    const feeLegs: Leg[] = [];
    for (const leg of group) {
      if (leg.op.includes("fee")) feeLegs.push(leg);
      else if (
        leg.op.includes("buy") ||
        leg.op.includes("sold") ||
        leg.op.includes("sell")
      )
        baseLegs.push(leg);
      else if (leg.op.includes("spend") || leg.op.includes("revenue"))
        quoteLegs.push(leg);
    }
    if (baseLegs.length === 0 || quoteLegs.length === 0) continue;

    const baseToken = baseLegs[0].token;
    const quoteToken = quoteLegs[0].token;
    const sameBase = baseLegs.every((l) => l.token === baseToken);
    const sameQuote = quoteLegs.every((l) => l.token === quoteToken);
    if (!sameBase || !sameQuote) continue;
    if (quoteCurrencyOf(quoteToken) === null) continue; // crypto/crypto spot

    const baseAmount = baseLegs.reduce((sum, l) => sum + l.amount, 0);
    const quoteAmount = quoteLegs.reduce((sum, l) => sum + Math.abs(l.amount), 0);
    const feeAmount = feeLegs
      .filter((l) => l.token === quoteToken)
      .reduce((sum, l) => sum + Math.abs(l.amount), 0);

    const row = makeRow(
      { ...baseLegs[0], amount: baseAmount },
      { ...quoteLegs[0], amount: quoteAmount },
      feeAmount,
    );
    if (row) {
      rows.push(row);
      for (const leg of group) consumed.add(leg.line);
    }
  }

  rows.sort((a, b) => (a.executedAt < b.executedAt ? -1 : 1));
  const tokens = [...new Set(rows.map((row) => row.token))];
  return { rows, skipped: dataLineCount - consumed.size, tokens };
}

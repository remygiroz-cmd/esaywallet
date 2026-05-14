// Parser for the Crypto.com App "transactions" CSV export.
//
// Header:
//   Timestamp (UTC),Transaction Description,Currency,Amount,To Currency,
//   To Amount,Native Currency,Native Amount,Native Amount (in USD),
//   Transaction Kind,Transaction Hash
// Unlike Binance, every row is a complete transaction with a "from" side
// (Currency / Amount) and a "to" side (To Currency / To Amount), plus a
// Native Amount giving its value in the user's fiat currency — so even
// crypto-to-crypto swaps can be priced.
//
//  - viban_purchase (fiat ↔ crypto)        → a buy or a sell
//  - crypto_exchange (crypto ↔ crypto)     → a sell + a buy, both flagged
//                                            tax-exempt (a swap isn't a
//                                            French taxable disposal)
//  - rewards / interest / referral / gift  → an acquisition at native value
//  - withdrawals, deposits, staking moves  → skipped (not buys or sells)
// Pure module — used both client-side (preview) and server-side (import).

import { parseCsvLine, detectDelimiter } from "@/lib/csv";

export type CryptoComRow = {
  line: number;
  token: string; // crypto symbol, upper-cased
  type: "BUY" | "SELL";
  executedAt: string; // ISO
  unitPrice: number;
  quantity: number;
  amountInvested: number; // proceeds for a sell
  fees: number;
  currency: string; // the value currency (EUR, USD…)
  taxExempt: boolean; // true for crypto-to-crypto swap legs
};

export type CryptoComParseResult = {
  rows: CryptoComRow[];
  skipped: number;
  tokens: string[];
};

const FIAT = new Set(["EUR", "USD", "GBP", "CHF"]);

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

function parseDate(raw: string | undefined): string | null {
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

function findColumn(
  header: string[],
  test: (name: string) => boolean,
  fallback: number,
): number {
  const index = header.findIndex((name) => test(normalize(name)));
  return index >= 0 ? index : fallback;
}

function buildRow(
  line: number,
  token: string,
  type: "BUY" | "SELL",
  executedAt: string,
  quantity: number,
  amountInvested: number,
  currency: string,
  taxExempt: boolean,
): CryptoComRow | null {
  if (quantity <= 0 || amountInvested <= 0) return null;
  const unitPrice = amountInvested / quantity;
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;
  return {
    line,
    token: token.toUpperCase(),
    type,
    executedAt,
    unitPrice,
    quantity,
    amountInvested,
    fees: 0,
    currency,
    taxExempt,
  };
}

export function parseCryptoComCsv(text: string): CryptoComParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { rows: [], skipped: 0, tokens: [] };

  const delimiter = detectDelimiter(lines[0]);
  const header = parseCsvLine(lines[0], delimiter);
  const idx = {
    timestamp: findColumn(
      header,
      (n) => n.includes("timestamp") || n.includes("date") || n.includes("time"),
      0,
    ),
    fromCurrency: findColumn(header, (n) => n === "currency", 2),
    fromAmount: findColumn(header, (n) => n === "amount", 3),
    toCurrency: findColumn(header, (n) => n.includes("to currency"), 4),
    toAmount: findColumn(header, (n) => n.includes("to amount"), 5),
    nativeCurrency: findColumn(header, (n) => n.includes("native currency"), 6),
    nativeAmount: findColumn(header, (n) => n === "native amount", 7),
    nativeAmountUsd: findColumn(
      header,
      (n) => n.includes("native amount") && n.includes("usd"),
      8,
    ),
    kind: findColumn(header, (n) => n.includes("kind"), 9),
  };

  const rows: CryptoComRow[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const fields = parseCsvLine(lines[i], delimiter);
    const cell = (index: number) => (index >= 0 ? fields[index] : undefined);
    const line = i + 1;

    const executedAt = parseDate(cell(idx.timestamp));
    if (executedAt === null) {
      skipped += 1;
      continue;
    }

    const kind = normalize(cell(idx.kind) ?? "");
    const fromCcy = (cell(idx.fromCurrency) ?? "").trim().toUpperCase();
    const fromAmount = parseSigned(cell(idx.fromAmount));
    const toCcy = (cell(idx.toCurrency) ?? "").trim().toUpperCase();
    const toAmount = parseSigned(cell(idx.toAmount));
    const nativeCcy = (cell(idx.nativeCurrency) ?? "").trim().toUpperCase();
    const nativeAmount = parseSigned(cell(idx.nativeAmount));
    const nativeAmountUsd = parseSigned(cell(idx.nativeAmountUsd));

    // Native value, in a currency the app understands.
    let nativeValue: number | null = null;
    let valueCurrency = "EUR";
    if (FIAT.has(nativeCcy) && nativeAmount !== null) {
      nativeValue = Math.abs(nativeAmount);
      valueCurrency = nativeCcy;
    } else if (nativeAmountUsd !== null) {
      nativeValue = Math.abs(nativeAmountUsd);
      valueCurrency = "USD";
    }

    // Withdrawals, deposits and staking/unstaking moves don't change what
    // the user owns in a taxable sense — they're skipped. ("unstaking"
    // also contains "staking", so both are caught.)
    if (
      kind.includes("withdrawal") ||
      kind.includes("deposit") ||
      kind.includes("staking") ||
      kind.includes("transfer")
    ) {
      skipped += 1;
      continue;
    }

    // Rewards, interest, referral bonuses, cashback, airdrops: crypto
    // received, recorded as an acquisition at its native value.
    const isReward =
      kind.includes("interest") ||
      kind.includes("reward") ||
      kind.includes("cashback") ||
      kind.includes("referral") ||
      kind.includes("bonus") ||
      kind.includes("gift") ||
      kind.includes("airdrop") ||
      kind.includes("distribution");
    if (isReward) {
      const row =
        fromCcy && !FIAT.has(fromCcy) && fromAmount !== null && nativeValue
          ? buildRow(
              line,
              fromCcy,
              "BUY",
              executedAt,
              Math.abs(fromAmount),
              nativeValue,
              valueCurrency,
              false,
            )
          : null;
      if (row) rows.push(row);
      else skipped += 1;
      continue;
    }

    // Exchanges and fiat purchases: a "from" side and a "to" side.
    const hasFrom =
      fromCcy !== "" && fromAmount !== null && fromAmount !== 0;
    const hasTo = toCcy !== "" && toAmount !== null && toAmount !== 0;
    if (hasFrom && hasTo) {
      const fromIsFiat = FIAT.has(fromCcy);
      const toIsFiat = FIAT.has(toCcy);
      let emitted = false;

      if (fromIsFiat && !toIsFiat) {
        // Bought crypto with fiat.
        const row = buildRow(
          line,
          toCcy,
          "BUY",
          executedAt,
          Math.abs(toAmount!),
          Math.abs(fromAmount!),
          fromCcy,
          false,
        );
        if (row) {
          rows.push(row);
          emitted = true;
        }
      } else if (!fromIsFiat && toIsFiat) {
        // Sold crypto for fiat.
        const row = buildRow(
          line,
          fromCcy,
          "SELL",
          executedAt,
          Math.abs(fromAmount!),
          Math.abs(toAmount!),
          toCcy,
          false,
        );
        if (row) {
          rows.push(row);
          emitted = true;
        }
      } else if (!fromIsFiat && !toIsFiat && nativeValue) {
        // Crypto-to-crypto swap: a sell of one side and a buy of the
        // other, both at the swap's native value, both tax-exempt.
        const sell = buildRow(
          line,
          fromCcy,
          "SELL",
          executedAt,
          Math.abs(fromAmount!),
          nativeValue,
          valueCurrency,
          true,
        );
        const buy = buildRow(
          line,
          toCcy,
          "BUY",
          executedAt,
          Math.abs(toAmount!),
          nativeValue,
          valueCurrency,
          true,
        );
        if (sell) {
          rows.push(sell);
          emitted = true;
        }
        if (buy) {
          rows.push(buy);
          emitted = true;
        }
      }

      if (!emitted) skipped += 1;
      continue;
    }

    skipped += 1;
  }

  rows.sort((a, b) => (a.executedAt < b.executedAt ? -1 : 1));
  const tokens = [...new Set(rows.map((row) => row.token))];
  return { rows, skipped, tokens };
}

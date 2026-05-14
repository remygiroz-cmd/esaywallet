// Parser for Bitstack's transaction-history CSV export.
//
// Bitstack uses a "received / sent" layout rather than a single
// symbol+quantity+price row. Header (French, sometimes UTF-8-mangled):
//   Type,Date,Fuseau horaire,Montant reçu,Monnaie ou jeton reçu,
//   Montant envoyé,Monnaie ou jeton envoyé,Frais,Monnaie ou jeton des frais,
//   Description,Prix du jeton du montant envoyé,Prix du jeton du montant reçu,…
// A buy = crypto received + euros sent; a sell = euros received + crypto
// sent; a "Dépôt"/"Parrainage" = crypto received with no euros (acquired
// at the row's token price); a "Retrait" = crypto sent with nothing
// received (a transfer out — not a taxable buy/sell, so it's skipped).
// Pure module — used both client-side (preview) and server-side (import).

import { parseCsvLine, detectDelimiter } from "@/lib/csv";

export type BitstackRow = {
  line: number;
  token: string; // symbol, upper-cased
  type: "BUY" | "SELL";
  executedAt: string; // ISO
  unitPrice: number; // EUR
  quantity: number;
  amountInvested: number; // EUR (proceeds for a sell)
  fees: number;
};

export type BitstackParseResult = {
  rows: BitstackRow[];
  skipped: number;
  tokens: string[];
};

const FIAT = new Set(["EUR", "USD", "GBP", "CHF", "CAD", "AUD", "JPY"]);

// Lower-cases, repairs the common UTF-8→Latin-1 mojibake (reçu → reÃ§u)
// and strips diacritics, so header matching works whatever the file's
// encoding ended up being.
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

// Tolerant number parser — Bitstack uses a dot decimal, but accept a
// comma decimal too.
function parseAmount(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let value = raw.replace(/[\s ]/g, "").trim();
  if (!value || value === "--") return null;
  if (value.includes(",")) {
    value = value.replace(/\./g, "").replace(",", ".");
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const date = new Date(raw.trim());
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function findColumn(
  header: string[],
  test: (name: string) => boolean,
): number {
  return header.findIndex((name) => test(normalize(name)));
}

export function parseBitstackCsv(text: string): BitstackParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { rows: [], skipped: 0, tokens: [] };

  const delimiter = detectDelimiter(lines[0]);
  const header = parseCsvLine(lines[0], delimiter);

  const idx = {
    date: findColumn(header, (n) => n === "date" || n.startsWith("date")),
    recvAmount: findColumn(
      header,
      (n) => n.includes("montant") && n.includes("recu"),
    ),
    recvCcy: findColumn(
      header,
      (n) =>
        (n.includes("monnaie") || n.includes("jeton")) &&
        n.includes("recu") &&
        !n.includes("prix"),
    ),
    sentAmount: findColumn(
      header,
      (n) => n.includes("montant") && n.includes("envoye"),
    ),
    sentCcy: findColumn(
      header,
      (n) =>
        (n.includes("monnaie") || n.includes("jeton")) &&
        n.includes("envoye") &&
        !n.includes("prix"),
    ),
    fees: findColumn(header, (n) => n === "frais"),
    feeCcy: findColumn(
      header,
      (n) =>
        n.includes("frais") &&
        (n.includes("monnaie") || n.includes("jeton")),
    ),
    priceRecv: findColumn(
      header,
      (n) => n.includes("prix") && n.includes("recu"),
    ),
    priceSent: findColumn(
      header,
      (n) => n.includes("prix") && n.includes("envoye"),
    ),
  };

  const rows: BitstackRow[] = [];
  let skipped = 0;
  const tokenSet = new Set<string>();

  for (let i = 1; i < lines.length; i += 1) {
    const fields = parseCsvLine(lines[i], delimiter);
    const cell = (index: number) => (index >= 0 ? fields[index] : undefined);

    const executedAt = parseDate(cell(idx.date));
    const recvAmount = parseAmount(cell(idx.recvAmount));
    const recvCcy = (cell(idx.recvCcy) ?? "").trim().toUpperCase();
    const sentAmount = parseAmount(cell(idx.sentAmount));
    const sentCcy = (cell(idx.sentCcy) ?? "").trim().toUpperCase();
    const fees = parseAmount(cell(idx.fees)) ?? 0;
    const feeCcy = (cell(idx.feeCcy) ?? "").trim().toUpperCase();
    const priceRecv = parseAmount(cell(idx.priceRecv));
    const priceSent = parseAmount(cell(idx.priceSent));

    if (executedAt === null) {
      skipped += 1;
      continue;
    }

    // Fees are only carried when they're in a fiat currency — a fee paid
    // in crypto isn't a euro amount.
    const fiatFees = feeCcy && !FIAT.has(feeCcy) ? 0 : fees;

    const hasRecv = recvAmount !== null && recvAmount > 0 && recvCcy !== "";
    const hasSent = sentAmount !== null && sentAmount > 0 && sentCcy !== "";
    const recvIsCrypto = recvCcy !== "" && !FIAT.has(recvCcy);
    const sentIsCrypto = sentCcy !== "" && !FIAT.has(sentCcy);

    let row: BitstackRow | null = null;

    if (hasRecv && recvIsCrypto && hasSent && !sentIsCrypto) {
      // Crypto received, euros sent → a buy.
      const unitPrice = priceRecv ?? sentAmount! / recvAmount!;
      if (unitPrice > 0) {
        row = {
          line: i + 1,
          token: recvCcy,
          type: "BUY",
          executedAt,
          unitPrice,
          quantity: recvAmount!,
          amountInvested: sentAmount!,
          fees: fiatFees,
        };
      }
    } else if (hasSent && sentIsCrypto && hasRecv && !recvIsCrypto) {
      // Crypto sent, euros received → a sell.
      const unitPrice = priceSent ?? recvAmount! / sentAmount!;
      if (unitPrice > 0) {
        row = {
          line: i + 1,
          token: sentCcy,
          type: "SELL",
          executedAt,
          unitPrice,
          quantity: sentAmount!,
          amountInvested: recvAmount!,
          fees: fiatFees,
        };
      }
    } else if (hasRecv && recvIsCrypto && !hasSent) {
      // Crypto received with no euros sent — a deposit, referral or
      // reward. Recorded as an acquisition at the row's token price so it
      // carries a cost basis.
      const unitPrice = priceRecv ?? priceSent;
      if (unitPrice !== null && unitPrice > 0) {
        row = {
          line: i + 1,
          token: recvCcy,
          type: "BUY",
          executedAt,
          unitPrice,
          quantity: recvAmount!,
          amountInvested: recvAmount! * unitPrice,
          fees: fiatFees,
        };
      }
    }
    // Anything else — a fiat deposit, a crypto withdrawal (transfer out),
    // a crypto-to-crypto swap, or an unparseable row — is skipped.

    if (row === null) {
      skipped += 1;
      continue;
    }

    tokenSet.add(row.token);
    rows.push(row);
  }

  return { rows, skipped, tokens: [...tokenSet] };
}

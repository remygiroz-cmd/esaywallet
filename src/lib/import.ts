// Parser for bulk transaction import — pure, used both client-side (live
// preview) and server-side (the actual import).
//
// Expected columns per line, tab- or semicolon-separated:
//   Date · Montant investi · Quantité · Prix unitaire · Frais (optionnel)
// A negative amount or quantity marks the row as a SELL. Lines that don't
// parse (header row, annotations…) are reported as skipped, never imported.

export type ParsedTransactionRow = {
  line: number;
  executedAt: string; // ISO date
  type: "BUY" | "SELL";
  unitPrice: number;
  quantity: number;
  amountInvested: number;
  fees: number;
};

export type ImportParseResult = {
  rows: ParsedTransactionRow[];
  skipped: { line: number; raw: string }[];
};

// Accepts French ("76 465,46", "0,0013") and plain ("1234.56") number
// formats, including a thousands separator.
function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const cleaned = raw.replace(/[\s ]/g, "").trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseDate(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const text = raw.trim();

  const fr = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) {
    const date = new Date(Date.UTC(+fr[3], +fr[2] - 1, +fr[1]));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const date = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

export function parseTransactionRows(text: string): ImportParseResult {
  const rows: ParsedTransactionRow[] = [];
  const skipped: { line: number; raw: string }[] = [];

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = index + 1;
    if (!rawLine.trim()) return;

    const fields = rawLine.includes("\t")
      ? rawLine.split("\t")
      : rawLine.split(";");

    const executedAt = parseDate(fields[0]);
    const amount = parseNumber(fields[1]);
    const quantity = parseNumber(fields[2]);
    const unitPrice = parseNumber(fields[3]);

    const invalid =
      executedAt === null ||
      amount === null ||
      quantity === null ||
      unitPrice === null ||
      amount === 0 ||
      quantity === 0 ||
      unitPrice <= 0;

    if (invalid) {
      skipped.push({ line, raw: rawLine.trim().slice(0, 80) });
      return;
    }

    const fees = parseNumber(fields[4]) ?? 0;
    const isSell = amount < 0 || quantity < 0;

    rows.push({
      line,
      executedAt,
      type: isSell ? "SELL" : "BUY",
      unitPrice: Math.abs(unitPrice),
      quantity: Math.abs(quantity),
      amountInvested: Math.abs(amount),
      fees: Math.abs(fees),
    });
  });

  return { rows, skipped };
}

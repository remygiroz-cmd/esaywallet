// Universal CSV transaction importer: detects which column is what, then
// parses any file against a (user-confirmable) mapping. Pure module — used
// client-side for detection/preview and server-side for the real import.

import { parseCsvLine, detectDelimiter } from "@/lib/csv";

export type GenericField =
  | "date"
  | "type"
  | "symbol"
  | "name"
  | "quantity"
  | "unitPrice"
  | "amount"
  | "fees"
  | "currency"
  | "assetClass";

export const GENERIC_FIELDS: GenericField[] = [
  "date",
  "type",
  "symbol",
  "name",
  "quantity",
  "unitPrice",
  "amount",
  "fees",
  "currency",
  "assetClass",
];

export const GENERIC_FIELD_LABELS: Record<GenericField, string> = {
  date: "Date",
  type: "Type (achat / vente)",
  symbol: "Symbole / ISIN",
  name: "Nom",
  quantity: "Quantité",
  unitPrice: "Prix unitaire",
  amount: "Montant",
  fees: "Frais",
  currency: "Devise",
  assetClass: "Nature de l'actif",
};

export type AssetClass = "STOCK" | "ETF" | "CRYPTO";

export type GenericMapping = {
  columns: Record<GenericField, number | null>;
  // Where the buy/sell information comes from.
  typeMode: "column" | "sign";
  // Disambiguates DD/MM vs MM/DD dates (ISO is always handled).
  dateFormat: "dmy" | "mdy";
  // Decimal/thousands convention.
  numberFormat: "us" | "eu";
  // Which provider to resolve identifiers against.
  assetKind: "auto" | "crypto" | "equity";
};

export type DetectionResult = {
  header: string[];
  mapping: GenericMapping;
};

export type GenericRow = {
  line: number;
  symbol: string;
  name: string;
  assetClass: AssetClass | null;
  type: "BUY" | "SELL";
  executedAt: string;
  unitPrice: number;
  quantity: number;
  amountInvested: number;
  fees: number;
  currency: string;
};

export type GenericAsset = {
  symbol: string;
  name: string;
  assetClass: AssetClass | null;
};

export type GenericParseResult = {
  rows: GenericRow[];
  skipped: number;
  assets: GenericAsset[];
};

// --- column header keyword tables --------------------------------------

const HEADER_KEYWORDS: Record<GenericField, string[]> = {
  date: ["datetime", "date", "executed", "time", "trade date"],
  type: ["type", "side", "operation", "sens", "action", "transaction type"],
  symbol: [
    "isin",
    "symbol",
    "symbole",
    "ticker",
    "token",
    "instrument",
    "asset",
    "actif",
    "titre",
    "coin",
    "code",
  ],
  name: ["name", "nom", "label", "libellé", "description", "company"],
  quantity: [
    "quantity",
    "shares",
    "quantité",
    "qty",
    "units",
    "nombre",
    "volume",
    "size",
  ],
  unitPrice: [
    "unit price",
    "price",
    "prix unitaire",
    "prix",
    "cours",
    "share price",
    "rate",
  ],
  amount: [
    "total value",
    "total",
    "amount",
    "montant",
    "net amount",
    "gross amount",
    "value",
    "proceeds",
    "cost",
  ],
  fees: ["fee", "fees", "frais", "commission", "charge"],
  currency: ["currency", "devise", "ccy"],
  assetClass: ["asset_class", "asset class", "category", "class", "kind"],
};

const BUY_WORDS = new Set([
  "buy",
  "b",
  "achat",
  "acheter",
  "purchase",
  "long",
]);
const SELL_WORDS = new Set([
  "sell",
  "s",
  "vente",
  "vendre",
  "sale",
  "short",
]);

// --- value helpers -----------------------------------------------------

function classifyType(raw: string | undefined): "BUY" | "SELL" | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (BUY_WORDS.has(value)) return "BUY";
  if (SELL_WORDS.has(value)) return "SELL";
  return null;
}

function classifyAssetClass(raw: string | undefined): AssetClass | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value.includes("crypto") || value.includes("coin")) return "CRYPTO";
  if (value.includes("etf") || value.includes("fund") || value.includes("fond"))
    return "ETF";
  if (
    value.includes("stock") ||
    value.includes("action") ||
    value.includes("equity") ||
    value.includes("share")
  )
    return "STOCK";
  return null;
}

function parseNumber(
  raw: string | undefined,
  format: "us" | "eu",
): number | null {
  if (raw === undefined) return null;
  let value = raw.replace(/[\s ]/g, "").trim();
  if (!value || value === "--") return null;
  if (format === "eu") {
    value = value.replace(/\./g, "").replace(",", ".");
  } else {
    value = value.replace(/,/g, "");
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoUtc(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseDate(
  raw: string | undefined,
  format: "dmy" | "mdy",
): string | null {
  if (raw === undefined) return null;
  const text = raw.trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return isoUtc(+iso[1], +iso[2], +iso[3]);

  const slash = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (slash) {
    const first = +slash[1];
    const second = +slash[2];
    const day = format === "mdy" ? second : first;
    const month = format === "mdy" ? first : second;
    return isoUtc(+slash[3], month, day);
  }

  const native = new Date(text);
  return Number.isNaN(native.getTime()) ? null : native.toISOString();
}

// --- detection ---------------------------------------------------------

function looksLikeDate(value: string): boolean {
  const t = value.trim();
  return (
    /^\d{4}-\d{1,2}-\d{1,2}/.test(t) ||
    /^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}/.test(t)
  );
}

function looksNumeric(value: string): boolean {
  const t = value.replace(/[\s ]/g, "").trim();
  if (!t || t === "--") return false;
  return /^-?[\d.,]+$/.test(t) && /\d/.test(t);
}

function detectColumnFor(
  field: GenericField,
  header: string[],
  columns: string[][],
): number | null {
  const keywords = HEADER_KEYWORDS[field];
  let best: { index: number; score: number } | null = null;

  header.forEach((rawName, index) => {
    const name = rawName.trim().toLowerCase();
    let score = 0;

    // Header keyword match — earlier keywords score higher.
    for (let k = 0; k < keywords.length; k += 1) {
      if (name === keywords[k]) {
        score += 100 - k;
        break;
      }
      if (name.includes(keywords[k])) {
        score += 60 - k;
        break;
      }
    }

    // Content sniffing for the format-sensitive fields.
    const samples = columns[index].filter((v) => v.trim().length > 0);
    if (samples.length > 0) {
      if (field === "date") {
        const ratio =
          samples.filter((v) => looksLikeDate(v)).length / samples.length;
        if (ratio > 0.7) score += 50;
      }
      if (field === "type") {
        const ratio =
          samples.filter((v) => classifyType(v) !== null).length /
          samples.length;
        if (ratio > 0.6) score += 80;
      }
      if (field === "assetClass") {
        const ratio =
          samples.filter((v) => classifyAssetClass(v) !== null).length /
          samples.length;
        if (ratio > 0.6) score += 40;
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { index, score };
    }
  });

  return best ? (best as { index: number }).index : null;
}

function detectNumberFormat(samples: string[]): "us" | "eu" {
  let us = 0;
  let eu = 0;
  for (const raw of samples) {
    const v = raw.trim();
    const hasComma = v.includes(",");
    const hasDot = v.includes(".");
    if (hasComma && hasDot) {
      if (v.lastIndexOf(",") > v.lastIndexOf(".")) eu += 1;
      else us += 1;
    } else if (hasComma && !hasDot) {
      eu += 1;
    } else if (hasDot && !hasComma) {
      us += 1;
    }
  }
  return eu > us ? "eu" : "us";
}

function detectDateFormat(samples: string[]): "dmy" | "mdy" {
  let dmy = 0;
  let mdy = 0;
  for (const raw of samples) {
    const m = raw.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d{4}/);
    if (!m) continue;
    if (+m[1] > 12) dmy += 1;
    else if (+m[2] > 12) mdy += 1;
  }
  return mdy > dmy ? "mdy" : "dmy";
}

export function detectMapping(text: string): DetectionResult {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return {
      header: lines[0] ? parseCsvLine(lines[0]) : [],
      mapping: {
        columns: Object.fromEntries(
          GENERIC_FIELDS.map((f) => [f, null]),
        ) as Record<GenericField, number | null>,
        typeMode: "column",
        dateFormat: "dmy",
        numberFormat: "eu",
        assetKind: "auto",
      },
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = parseCsvLine(lines[0], delimiter);
  const sampleRows = lines
    .slice(1, 31)
    .map((line) => parseCsvLine(line, delimiter));
  const columns: string[][] = header.map((_, index) =>
    sampleRows.map((row) => row[index] ?? ""),
  );

  const mappedColumns = Object.fromEntries(
    GENERIC_FIELDS.map((field) => [
      field,
      detectColumnFor(field, header, columns),
    ]),
  ) as Record<GenericField, number | null>;

  // Number / date format detection from the chosen numeric & date columns.
  const numericSamples: string[] = [];
  for (const field of ["quantity", "unitPrice", "amount", "fees"] as const) {
    const index = mappedColumns[field];
    if (index !== null) {
      numericSamples.push(...columns[index].filter((v) => looksNumeric(v)));
    }
  }
  const dateSamples =
    mappedColumns.date !== null ? columns[mappedColumns.date] : [];

  return {
    header,
    mapping: {
      columns: mappedColumns,
      typeMode: mappedColumns.type !== null ? "column" : "sign",
      dateFormat: detectDateFormat(dateSamples),
      numberFormat: detectNumberFormat(numericSamples),
      assetKind: "auto",
    },
  };
}

// --- parsing -----------------------------------------------------------

export function parseGenericCsv(
  text: string,
  mapping: GenericMapping,
): GenericParseResult {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { rows: [], skipped: 0, assets: [] };

  const delimiter = detectDelimiter(lines[0]);
  const { columns } = mapping;
  const cell = (fields: string[], field: GenericField): string | undefined => {
    const index = columns[field];
    return index === null ? undefined : fields[index];
  };

  const rows: GenericRow[] = [];
  let skipped = 0;
  const assetMap = new Map<string, GenericAsset>();

  for (let i = 1; i < lines.length; i += 1) {
    const fields = parseCsvLine(lines[i], delimiter);

    const symbol = (cell(fields, "symbol") ?? "").trim().toUpperCase();
    const executedAt = parseDate(cell(fields, "date"), mapping.dateFormat);
    const unitPrice = parseNumber(
      cell(fields, "unitPrice"),
      mapping.numberFormat,
    );
    const quantity = parseNumber(
      cell(fields, "quantity"),
      mapping.numberFormat,
    );
    const amount = parseNumber(cell(fields, "amount"), mapping.numberFormat);

    let type: "BUY" | "SELL" | null;
    if (mapping.typeMode === "column") {
      type = classifyType(cell(fields, "type"));
    } else {
      const signal = amount ?? quantity;
      type = signal === null ? null : signal < 0 ? "SELL" : "BUY";
    }

    if (
      !symbol ||
      executedAt === null ||
      type === null ||
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

    const assetClass = classifyAssetClass(cell(fields, "assetClass"));
    const name = (cell(fields, "name") ?? "").trim() || symbol;
    const currency =
      (cell(fields, "currency") ?? "").trim().toUpperCase() || "EUR";

    if (!assetMap.has(symbol)) {
      assetMap.set(symbol, { symbol, name, assetClass });
    }

    rows.push({
      line: i + 1,
      symbol,
      name,
      assetClass,
      type,
      executedAt,
      unitPrice: Math.abs(unitPrice),
      quantity: Math.abs(quantity),
      amountInvested: Math.abs(amount),
      fees: Math.abs(parseNumber(cell(fields, "fees"), mapping.numberFormat) ?? 0),
      currency,
    });
  }

  return { rows, skipped, assets: [...assetMap.values()] };
}

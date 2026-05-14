// Parser for a bank's realised-gains tax statement (e.g. a Boursorama CTO
// "imprimé fiscal unique"): one line per security with the +/- value the
// bank already computed. Pure module — used client-side for the preview
// and server-side for the import.

import { parseCsvLine, detectDelimiter } from "@/lib/csv";

export type RealizedGainRow = {
  line: number;
  name: string;
  code: string | null;
  proceeds: number; // total disposals (cessions)
  realizedGain: number; // +/- value réalisée (can be negative)
};

export type RealizedGainParseResult = {
  rows: RealizedGainRow[];
  skipped: number;
};

type Field = "name" | "code" | "realizedGain" | "proceeds";

const HEADER_KEYWORDS: Record<Field, string[]> = {
  name: ["libellé", "libelle", "désignation", "designation", "valeur", "titre", "nom", "security", "name"],
  code: ["isin", "code"],
  realizedGain: [
    "+/- value",
    "+/-value",
    "plus-value",
    "moins-value",
    "plus value",
    "value réalis",
    "values réalis",
    "value realis",
    "values realis",
    "résultat",
    "resultat",
    "gain",
    "pv/mv",
    "pmv",
  ],
  proceeds: ["cession", "produit", "montant des ventes", "vente", "proceeds"],
};

// Accepts French ("1 076,79", "-60,44", "(60,44)") and plain ("1076.79")
// number formats, including currency symbols and thousands separators.
function parseAmount(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let value = raw.replace(/[\s  €$]/g, "").trim();
  if (!value || value === "-" || value === "--") return null;

  let negative = false;
  if (value.startsWith("(") && value.endsWith(")")) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (value.startsWith("-")) {
    negative = true;
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }

  // A comma means French formatting: dots are thousands separators.
  if (value.includes(",")) {
    value = value.replace(/\./g, "").replace(",", ".");
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function detectColumn(
  field: Field,
  header: string[],
): number | null {
  const keywords = HEADER_KEYWORDS[field];
  let best: { index: number; score: number } | null = null;
  header.forEach((rawName, index) => {
    const name = rawName.trim().toLowerCase();
    if (!name) return;
    for (let k = 0; k < keywords.length; k += 1) {
      const keyword = keywords[k];
      let score = 0;
      if (name === keyword) score = 100 - k;
      else if (name.includes(keyword)) score = 60 - k;
      if (score > 0 && (!best || score > best.score)) {
        best = { index, score };
      }
    }
  });
  return best ? (best as { index: number }).index : null;
}

export function parseRealizedGainCsv(text: string): RealizedGainParseResult {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { rows: [], skipped: 0 };

  const delimiter = detectDelimiter(lines[0]);
  const header = parseCsvLine(lines[0], delimiter);

  // Detect columns by header keyword, with the Boursorama layout as a
  // fallback (Libellé · Code · +/- value · Cessions).
  const nameCol = detectColumn("name", header) ?? 0;
  const codeCol = detectColumn("code", header) ?? 1;
  const gainCol = detectColumn("realizedGain", header) ?? 2;
  const proceedsCol = detectColumn("proceeds", header) ?? 3;

  const rows: RealizedGainRow[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const fields = parseCsvLine(lines[i], delimiter);
    const name = (fields[nameCol] ?? "").trim();
    const realizedGain = parseAmount(fields[gainCol]);

    // Skip blank lines, totals and anything without a usable gain figure.
    if (
      !name ||
      name.toLowerCase().startsWith("total") ||
      realizedGain === null
    ) {
      skipped += 1;
      continue;
    }

    const code = (fields[codeCol] ?? "").trim() || null;
    const proceeds = parseAmount(fields[proceedsCol]) ?? 0;

    rows.push({
      line: i + 1,
      name,
      code,
      proceeds: Math.abs(proceeds),
      realizedGain,
    });
  }

  return { rows, skipped };
}

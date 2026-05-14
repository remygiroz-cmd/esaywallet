// Merges transaction rows parsed from several CSV files into one list,
// flagging cross-file duplicates. Pure module — used client-side for the
// consolidated review and server-side as the payload shape for the import.

import type { GenericRow, AssetClass } from "@/lib/import-generic";

export type ImportAssetKind = "auto" | "crypto" | "equity";

// One parsed file: its name, the asset-resolution hint from its mapping,
// and the rows produced by parseGenericCsv.
export type ParsedFile = {
  fileName: string;
  assetKind: ImportAssetKind;
  rows: GenericRow[];
};

export type MergedRow = GenericRow & {
  sourceFile: string;
  assetKind: ImportAssetKind;
  signature: string;
  // Index (into the merged list) of the first row sharing this signature,
  // or null when this row is itself the first occurrence.
  duplicateOf: number | null;
};

// The shape sent to the server action: a normalised row plus the hint
// needed to resolve its asset to a live-price provider.
export type ImportPayloadRow = {
  symbol: string;
  name: string;
  assetClass: AssetClass | null;
  assetKind: ImportAssetKind;
  type: "BUY" | "SELL";
  executedAt: string;
  unitPrice: number;
  quantity: number;
  amountInvested: number;
  fees: number;
  currency: string;
};

// A stable fingerprint for a transaction — same trade exported from two
// files (or the same file imported twice) produces the same signature.
export function transactionSignature(row: {
  executedAt: string;
  symbol: string;
  type: string;
  quantity: number;
  amountInvested: number;
}): string {
  const day = row.executedAt.slice(0, 10);
  const qty = Math.round(row.quantity * 1e8) / 1e8;
  const amount = Math.round(row.amountInvested * 100) / 100;
  return `${day}|${row.symbol}|${row.type}|${qty}|${amount}`;
}

export function mergeImportFiles(files: ParsedFile[]): MergedRow[] {
  const merged: MergedRow[] = [];
  const firstSeenAt = new Map<string, number>();

  for (const file of files) {
    for (const row of file.rows) {
      const signature = transactionSignature(row);
      const firstIndex = firstSeenAt.get(signature);
      merged.push({
        ...row,
        sourceFile: file.fileName,
        assetKind: file.assetKind,
        signature,
        duplicateOf: firstIndex ?? null,
      });
      if (firstIndex === undefined) {
        firstSeenAt.set(signature, merged.length - 1);
      }
    }
  }

  return merged;
}

export function toPayloadRow(row: MergedRow): ImportPayloadRow {
  return {
    symbol: row.symbol,
    name: row.name,
    assetClass: row.assetClass,
    assetKind: row.assetKind,
    type: row.type,
    executedAt: row.executedAt,
    unitPrice: row.unitPrice,
    quantity: row.quantity,
    amountInvested: row.amountInvested,
    fees: row.fees,
    currency: row.currency,
  };
}

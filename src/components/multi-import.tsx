"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  importMultiAction,
  type BulkImportState,
} from "@/app/(app)/transactions/actions";
import {
  detectMapping,
  parseGenericCsv,
  GENERIC_FIELDS,
  GENERIC_FIELD_LABELS,
  type GenericMapping,
  type GenericField,
  type AssetClass,
} from "@/lib/import-generic";
import {
  mergeImportFiles,
  toPayloadRow,
  type ParsedFile,
} from "@/lib/import-multi";
import { formatCurrency, formatDate } from "@/lib/format";
import { ui } from "@/lib/ui";

type WalletOption = {
  id: string;
  name: string;
  currency: string;
  type: string;
};

type FileEntry = {
  id: string;
  name: string;
  text: string;
  header: string[];
  mapping: GenericMapping;
};

const initialState: BulkImportState = {};
const NONE = -1;
const controlClass =
  "rounded-md border border-black/[.12] bg-white px-2 py-1 text-xs text-zinc-600 dark:border-white/[.16] dark:bg-black dark:text-zinc-300";

function defaultWalletForAsset(
  wallets: WalletOption[],
  assetClass: AssetClass | null,
): string {
  const pick = (types: string[]) => {
    for (const type of types) {
      const match = wallets.find((wallet) => wallet.type === type);
      if (match) return match.id;
    }
    return wallets[0]?.id ?? "";
  };
  if (assetClass === "CRYPTO") return pick(["CRYPTO"]);
  if (assetClass === "ETF") return pick(["PEA", "CTO"]);
  if (assetClass === "STOCK") return pick(["CTO"]);
  return wallets[0]?.id ?? "";
}

export function MultiImport({ wallets }: { wallets: WalletOption[] }) {
  const [files, setFiles] = useState<FileEntry[]>([]);

  function addFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    Promise.all(
      selected.map(async (file) => {
        const text = await file.text();
        const detected = detectMapping(text);
        return {
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          name: file.name,
          text,
          header: detected.header,
          mapping: detected.mapping,
        };
      }),
    ).then((entries) => setFiles((current) => [...current, ...entries]));
  }

  function removeFile(id: string) {
    setFiles((current) => current.filter((file) => file.id !== id));
  }

  function updateMapping(id: string, mapping: GenericMapping) {
    setFiles((current) =>
      current.map((file) =>
        file.id === id ? { ...file, mapping } : file,
      ),
    );
  }

  const parsedFiles: ParsedFile[] = useMemo(
    () =>
      files.map((file) => ({
        fileName: file.name,
        assetKind: file.mapping.assetKind,
        rows: parseGenericCsv(file.text, file.mapping).rows,
      })),
    [files],
  );

  // Remount the review whenever the set of files or any mapping changes —
  // resets the duplicate decisions and wallet routing to fresh defaults.
  const filesKey = useMemo(
    () =>
      files
        .map((file) => `${file.id}:${JSON.stringify(file.mapping)}`)
        .join("|"),
    [files],
  );

  if (wallets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
        Créez d&apos;abord un wallet pour pouvoir importer.
      </div>
    );
  }

  return (
    <div className={`${ui.card} flex flex-col gap-4`}>
      <label className={ui.label}>
        Fichiers CSV — vous pouvez en déposer plusieurs à la fois
        <input
          type="file"
          accept=".csv,text/csv"
          multiple
          onChange={addFiles}
          className="w-full rounded-lg border border-black/[.12] bg-white px-3 py-2 text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white dark:border-white/[.16] dark:bg-black dark:text-zinc-300"
        />
        <span className="text-xs font-normal text-zinc-400">
          Exports de n&apos;importe quel courtier. Chaque fichier est analysé
          séparément ; les transactions en double entre fichiers sont
          détectées et exclues automatiquement.
        </span>
      </label>

      {files.map((file) => (
        <FileMappingPanel
          key={file.id}
          file={file}
          rowCount={
            parsedFiles.find((p) => p.fileName === file.name)?.rows.length ?? 0
          }
          onRemove={() => removeFile(file.id)}
          onMappingChange={(mapping) => updateMapping(file.id, mapping)}
        />
      ))}

      {parsedFiles.length > 0 ? (
        <ImportReview
          key={filesKey}
          parsedFiles={parsedFiles}
          wallets={wallets}
        />
      ) : null}
    </div>
  );
}

function FileMappingPanel({
  file,
  rowCount,
  onRemove,
  onMappingChange,
}: {
  file: FileEntry;
  rowCount: number;
  onRemove: () => void;
  onMappingChange: (mapping: GenericMapping) => void;
}) {
  const [open, setOpen] = useState(false);
  const { mapping, header } = file;

  function updateColumn(field: GenericField, index: number | null) {
    onMappingChange({
      ...mapping,
      columns: { ...mapping.columns, [field]: index },
    });
  }

  function updateField<K extends keyof GenericMapping>(
    key: K,
    value: GenericMapping[K],
  ) {
    onMappingChange({ ...mapping, [key]: value });
  }

  return (
    <div className="rounded-lg border border-black/[.1] dark:border-white/[.12]">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 items-center gap-2 text-left text-sm"
        >
          <span className="text-zinc-400">{open ? "▾" : "▸"}</span>
          <span className="truncate font-medium text-black dark:text-zinc-50">
            {file.name}
          </span>
          <span className="shrink-0 text-xs text-zinc-400">
            {rowCount} ligne{rowCount === 1 ? "" : "s"}
          </span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-xs text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
        >
          Retirer
        </button>
      </div>

      {open ? (
        <div className="flex flex-col gap-3 border-t border-black/[.06] p-3 dark:border-white/[.08]">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Association des colonnes — vérifiez et corrigez si besoin
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {GENERIC_FIELDS.map((field) => (
              <label
                key={field}
                className="flex items-center justify-between gap-2 text-sm text-zinc-700 dark:text-zinc-300"
              >
                <span className="shrink-0">
                  {GENERIC_FIELD_LABELS[field]}
                </span>
                <select
                  value={String(mapping.columns[field] ?? NONE)}
                  onChange={(event) =>
                    updateColumn(
                      field,
                      Number(event.target.value) === NONE
                        ? null
                        : Number(event.target.value),
                    )
                  }
                  className={controlClass}
                >
                  <option value={NONE}>(non utilisée)</option>
                  {header.map((name, index) => (
                    <option key={index} value={index}>
                      {name || `Colonne ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 border-t border-black/[.06] pt-3 dark:border-white/[.08]">
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              Type d&apos;opération
              <select
                value={mapping.typeMode}
                onChange={(event) =>
                  updateField(
                    "typeMode",
                    event.target.value as GenericMapping["typeMode"],
                  )
                }
                className={controlClass}
              >
                <option value="column">depuis une colonne</option>
                <option value="sign">depuis le signe du montant</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              Format de date
              <select
                value={mapping.dateFormat}
                onChange={(event) =>
                  updateField(
                    "dateFormat",
                    event.target.value as GenericMapping["dateFormat"],
                  )
                }
                className={controlClass}
              >
                <option value="dmy">JJ/MM/AAAA</option>
                <option value="mdy">MM/JJ/AAAA</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              Nombres
              <select
                value={mapping.numberFormat}
                onChange={(event) =>
                  updateField(
                    "numberFormat",
                    event.target.value as GenericMapping["numberFormat"],
                  )
                }
                className={controlClass}
              >
                <option value="eu">1&nbsp;234,56</option>
                <option value="us">1,234.56</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
              Nature des actifs
              <select
                value={mapping.assetKind}
                onChange={(event) =>
                  updateField(
                    "assetKind",
                    event.target.value as GenericMapping["assetKind"],
                  )
                }
                className={controlClass}
              >
                <option value="auto">Détection auto</option>
                <option value="crypto">Cryptos</option>
                <option value="equity">Actions &amp; ETF</option>
              </select>
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ImportReview({
  parsedFiles,
  wallets,
}: {
  parsedFiles: ParsedFile[];
  wallets: WalletOption[];
}) {
  const [state, formAction, pending] = useActionState(
    importMultiAction,
    initialState,
  );

  const merged = useMemo(() => mergeImportFiles(parsedFiles), [parsedFiles]);

  // Cross-file duplicates start excluded; the user can re-include any.
  const [excluded, setExcluded] = useState<Set<number>>(
    () =>
      new Set(
        merged
          .map((row, index) => (row.duplicateOf !== null ? index : -1))
          .filter((index) => index >= 0),
      ),
  );

  const includedRows = useMemo(
    () => merged.filter((_, index) => !excluded.has(index)),
    [merged, excluded],
  );

  // Unique assets across the kept rows, with a name and asset-class guess.
  const assets = useMemo(() => {
    const map = new Map<
      string,
      { symbol: string; name: string; assetClass: AssetClass | null }
    >();
    for (const row of includedRows) {
      const existing = map.get(row.symbol);
      if (!existing) {
        map.set(row.symbol, {
          symbol: row.symbol,
          name: row.name,
          assetClass: row.assetClass,
        });
      } else if (!existing.assetClass && row.assetClass) {
        existing.assetClass = row.assetClass;
      }
    }
    return [...map.values()];
  }, [includedRows]);

  const [walletBySymbol, setWalletBySymbol] = useState<
    Record<string, string>
  >(() => ({}));

  // Effective routing: a stored override, else the asset-class default.
  const routing = useMemo(() => {
    const result: Record<string, string> = {};
    for (const asset of assets) {
      result[asset.symbol] =
        walletBySymbol[asset.symbol] ??
        defaultWalletForAsset(wallets, asset.assetClass);
    }
    return result;
  }, [assets, walletBySymbol, wallets]);

  const duplicateCount = merged.filter(
    (row) => row.duplicateOf !== null,
  ).length;

  const payload = useMemo(
    () =>
      JSON.stringify({
        rows: includedRows.map(toPayloadRow),
        walletBySymbol: routing,
      }),
    [includedRows, routing],
  );

  function toggleExcluded(index: number) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  if (state.imported !== undefined) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/50">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          ✓ {state.imported} transaction{state.imported === 1 ? "" : "s"}{" "}
          importée{state.imported === 1 ? "" : "s"} sur {state.assetsCount}{" "}
          asset{state.assetsCount === 1 ? "" : "s"}.
        </p>
        {typeof state.resolvedCount === "number" &&
        typeof state.assetsCount === "number" &&
        state.resolvedCount < state.assetsCount ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {state.resolvedCount}/{state.assetsCount} assets ont leur prix en
            direct résolu automatiquement. Pour les autres, renseignez
            l&apos;identifiant sur la page Assets.
          </p>
        ) : null}
        <Link href="/transactions" className={ui.primaryButton}>
          Voir mes transactions
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="payload" value={payload} />

      <div className="rounded-lg border border-black/[.08] bg-zinc-50 p-3 text-sm dark:border-white/[.1] dark:bg-zinc-900">
        <p className="font-medium text-zinc-700 dark:text-zinc-200">
          {includedRows.length} transaction
          {includedRows.length === 1 ? "" : "s"} à importer ·{" "}
          {assets.length} asset{assets.length === 1 ? "" : "s"}
          {duplicateCount > 0
            ? ` · ${duplicateCount} doublon${
                duplicateCount === 1 ? "" : "s"
              } détecté${duplicateCount === 1 ? "" : "s"}`
            : ""}
        </p>
      </div>

      {duplicateCount > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Doublons détectés — décochés par défaut, ré-incluez-les si besoin
          </p>
          <div className="flex max-h-60 flex-col divide-y divide-black/[.06] overflow-y-auto rounded-lg border border-black/[.08] dark:divide-white/[.06] dark:border-white/[.1]">
            {merged.map((row, index) =>
              row.duplicateOf === null ? null : (
                <label
                  key={index}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={!excluded.has(index)}
                    onChange={() => toggleExcluded(index)}
                  />
                  <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">
                    {formatDate(row.executedAt)} · {row.symbol} ·{" "}
                    {row.type === "SELL" ? "Vente" : "Achat"} ·{" "}
                    {formatCurrency(row.amountInvested, row.currency)}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-zinc-400">
                    {row.sourceFile}
                  </span>
                </label>
              ),
            )}
          </div>
        </div>
      ) : null}

      {assets.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Wallet de destination par asset
          </p>
          <div className="flex max-h-72 flex-col divide-y divide-black/[.06] overflow-y-auto rounded-lg border border-black/[.08] dark:divide-white/[.06] dark:border-white/[.1]">
            {assets.map((asset) => (
              <div
                key={asset.symbol}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-black dark:text-zinc-50">
                    {asset.name}
                  </p>
                  <p className="font-mono text-xs text-zinc-400">
                    {asset.symbol}
                    {asset.assetClass ? ` · ${asset.assetClass}` : ""}
                  </p>
                </div>
                <select
                  value={routing[asset.symbol]}
                  onChange={(event) =>
                    setWalletBySymbol((current) => ({
                      ...current,
                      [asset.symbol]: event.target.value,
                    }))
                  }
                  className="shrink-0 rounded-md border border-black/[.12] bg-white px-2 py-1 text-xs text-zinc-600 dark:border-white/[.16] dark:bg-black dark:text-zinc-300"
                >
                  {wallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name} ({wallet.currency})
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {state.error ? <p className={ui.errorText}>{state.error}</p> : null}

      <div>
        <button
          type="submit"
          disabled={pending || includedRows.length === 0}
          className={ui.primaryButton}
        >
          {pending
            ? "Import en cours…"
            : `Importer ${includedRows.length} transaction${
                includedRows.length === 1 ? "" : "s"
              }`}
        </button>
      </div>
    </form>
  );
}

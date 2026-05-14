"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  importGenericAction,
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
import { ui } from "@/lib/ui";

type WalletOption = {
  id: string;
  name: string;
  currency: string;
  type: string;
};

const initialState: BulkImportState = {};
const NONE = -1;

function defaultWalletId(
  wallets: WalletOption[],
  preferredTypes: string[],
): string {
  for (const type of preferredTypes) {
    const match = wallets.find((wallet) => wallet.type === type);
    if (match) return match.id;
  }
  return wallets[0]?.id ?? "";
}

function defaultWalletForAsset(
  wallets: WalletOption[],
  assetClass: AssetClass | null,
): string {
  if (assetClass === "CRYPTO") return defaultWalletId(wallets, ["CRYPTO"]);
  if (assetClass === "ETF") return defaultWalletId(wallets, ["PEA", "CTO"]);
  if (assetClass === "STOCK") return defaultWalletId(wallets, ["CTO"]);
  return wallets[0]?.id ?? "";
}

const controlClass =
  "rounded-md border border-black/[.12] bg-white px-2 py-1 text-xs text-zinc-600 dark:border-white/[.16] dark:bg-black dark:text-zinc-300";

export function GenericImport({ wallets }: { wallets: WalletOption[] }) {
  const [state, formAction, pending] = useActionState(
    importGenericAction,
    initialState,
  );
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [header, setHeader] = useState<string[]>([]);
  const [mapping, setMapping] = useState<GenericMapping | null>(null);

  const preview = useMemo(
    () => (mapping && text ? parseGenericCsv(text, mapping) : null),
    [text, mapping],
  );

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    file.text().then((content) => {
      const detected = detectMapping(content);
      setText(content);
      setHeader(detected.header);
      setMapping(detected.mapping);
    });
  }

  function updateColumn(field: GenericField, index: number | null) {
    setMapping((current) =>
      current
        ? { ...current, columns: { ...current.columns, [field]: index } }
        : current,
    );
  }

  function updateMapping<K extends keyof GenericMapping>(
    key: K,
    value: GenericMapping[K],
  ) {
    setMapping((current) =>
      current ? { ...current, [key]: value } : current,
    );
  }

  if (state.imported !== undefined) {
    return (
      <div className={`${ui.card} flex flex-col items-start gap-3`}>
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
            direct résolu automatiquement. Pour les autres, renseigne
            l&apos;identifiant sur la page Assets.
          </p>
        ) : null}
        <Link href="/transactions" className={ui.primaryButton}>
          Voir mes transactions
        </Link>
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
        Créez d&apos;abord un wallet pour pouvoir importer.
      </div>
    );
  }

  const assetsKey = preview
    ? preview.assets.map((asset) => asset.symbol).join("|")
    : "";

  return (
    <form action={formAction} className={`${ui.card} flex flex-col gap-4`}>
      <input type="hidden" name="data" value={text} />
      {mapping ? (
        <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
      ) : null}

      <label className={ui.label}>
        Fichier CSV (n&apos;importe quel courtier)
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="w-full rounded-lg border border-black/[.12] bg-white px-3 py-2 text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white dark:border-white/[.16] dark:bg-black dark:text-zinc-300"
        />
        {fileName ? (
          <span className="text-xs font-normal text-zinc-400">
            {fileName}
          </span>
        ) : null}
      </label>

      {mapping ? (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-black/[.15] p-4 dark:border-white/[.15]">
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
                  updateMapping(
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
                  updateMapping(
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
                  updateMapping(
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
                  updateMapping(
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

      {preview ? (
        <>
          <div className="rounded-lg border border-black/[.08] bg-zinc-50 p-3 text-sm dark:border-white/[.1] dark:bg-zinc-900">
            <p className="font-medium text-zinc-700 dark:text-zinc-200">
              {preview.rows.length} transaction
              {preview.rows.length === 1 ? "" : "s"} · {preview.assets.length}{" "}
              asset{preview.assets.length === 1 ? "" : "s"} détecté
              {preview.assets.length === 1 ? "" : "s"}
              {preview.skipped > 0
                ? ` · ${preview.skipped} ligne${
                    preview.skipped === 1 ? "" : "s"
                  } ignorée${preview.skipped === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>

          {preview.assets.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Wallet de destination par asset
              </p>
              <div
                key={assetsKey}
                className="flex max-h-72 flex-col divide-y divide-black/[.06] overflow-y-auto rounded-lg border border-black/[.08] dark:divide-white/[.06] dark:border-white/[.1]"
              >
                {preview.assets.map((asset) => (
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
                      name={`wallet_${asset.symbol}`}
                      required
                      defaultValue={defaultWalletForAsset(
                        wallets,
                        asset.assetClass,
                      )}
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
        </>
      ) : null}

      {state.error ? <p className={ui.errorText}>{state.error}</p> : null}

      <div>
        <button
          type="submit"
          disabled={pending || !preview || preview.rows.length === 0}
          className={ui.primaryButton}
        >
          {pending
            ? "Import en cours…"
            : preview && preview.rows.length > 0
              ? `Importer ${preview.rows.length} transaction${
                  preview.rows.length === 1 ? "" : "s"
                }`
              : "Importer le fichier"}
        </button>
      </div>
    </form>
  );
}

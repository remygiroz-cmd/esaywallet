"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  importTrAction,
  type BulkImportState,
} from "@/app/(app)/transactions/actions";
import { parseTrCsv } from "@/lib/import-tr";
import { ui } from "@/lib/ui";

type WalletOption = {
  id: string;
  name: string;
  currency: string;
  type: string;
};

const initialState: BulkImportState = {};

const CLASS_LABELS: Record<string, string> = {
  STOCK: "Wallet pour les actions",
  ETF: "Wallet pour les ETF / fonds",
};

// Picks a sensible default wallet for an asset class, by wallet type.
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

function defaultWalletForClass(
  wallets: WalletOption[],
  assetClass: string,
): string {
  if (assetClass === "ETF") {
    return defaultWalletId(wallets, ["PEA", "CTO"]);
  }
  return defaultWalletId(wallets, ["CTO"]);
}

export function TrImport({ wallets }: { wallets: WalletOption[] }) {
  const [state, formAction, pending] = useActionState(
    importTrAction,
    initialState,
  );
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");

  const preview = useMemo(() => (text ? parseTrCsv(text) : null), [text]);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    file.text().then((content) => setText(content));
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
            direct résolu automatiquement. Pour les autres, renseigne le
            symbole Yahoo sur la page Assets.
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

  return (
    <form action={formAction} className={`${ui.card} flex flex-col gap-4`}>
      <input type="hidden" name="data" value={text} />

      <label className={ui.label}>
        Fichier Trade Republic (.csv)
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

      {preview ? (
        <>
          <div className="rounded-lg border border-black/[.08] bg-zinc-50 p-3 text-sm dark:border-white/[.1] dark:bg-zinc-900">
            <p className="font-medium text-zinc-700 dark:text-zinc-200">
              {preview.rows.length} transaction
              {preview.rows.length === 1 ? "" : "s"} · {preview.isins.length}{" "}
              asset{preview.isins.length === 1 ? "" : "s"} détecté
              {preview.isins.length === 1 ? "" : "s"}
              {preview.skipped > 0
                ? ` · ${preview.skipped} ligne${
                    preview.skipped === 1 ? "" : "s"
                  } ignorée${preview.skipped === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>

          {preview.classes.length > 0 ? (
            <div className="flex flex-col gap-4 sm:flex-row">
              {preview.classes.map((assetClass) => (
                <label key={assetClass} className={`${ui.label} flex-1`}>
                  {CLASS_LABELS[assetClass] ?? assetClass}
                  <select
                    name={`wallet_${assetClass}`}
                    required
                    defaultValue={defaultWalletForClass(wallets, assetClass)}
                    className={ui.input}
                  >
                    {wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.name} ({wallet.currency})
                      </option>
                    ))}
                  </select>
                </label>
              ))}
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

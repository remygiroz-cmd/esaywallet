"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  importCryptoComAction,
  type BulkImportState,
} from "@/app/(app)/transactions/actions";
import { parseCryptoComCsv } from "@/lib/import-cryptocom";
import { ui } from "@/lib/ui";

type WalletOption = {
  id: string;
  name: string;
  currency: string;
  type: string;
};

const initialState: BulkImportState = {};

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

export function CryptoComImport({ wallets }: { wallets: WalletOption[] }) {
  const [state, formAction, pending] = useActionState(
    importCryptoComAction,
    initialState,
  );
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");

  const preview = useMemo(
    () => (text ? parseCryptoComCsv(text) : null),
    [text],
  );
  const cryptoDefault = defaultWalletId(wallets, ["CRYPTO"]);

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

  return (
    <form action={formAction} className={`${ui.card} flex flex-col gap-4`}>
      <input type="hidden" name="data" value={text} />

      <label className={ui.label}>
        Fichier Crypto.com — export des transactions (.csv)
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
              {preview.rows.length === 1 ? "" : "s"} · {preview.tokens.length}{" "}
              asset{preview.tokens.length === 1 ? "" : "s"} détecté
              {preview.tokens.length === 1 ? "" : "s"}
              {preview.skipped > 0
                ? ` · ${preview.skipped} ligne${
                    preview.skipped === 1 ? "" : "s"
                  } ignorée${preview.skipped === 1 ? "" : "s"}`
                : ""}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Achats en euros, récompenses (staking, parrainage) et échanges
              crypto↔crypto sont importés — les échanges entre cryptos sont
              marqués non imposables. Les dépôts, retraits et mises en
              staking sont ignorés.
            </p>
          </div>

          {preview.tokens.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Wallet de destination par asset
              </p>
              <div
                key={`${fileName}:${preview.rows.length}`}
                className="flex max-h-72 flex-col divide-y divide-black/[.06] overflow-y-auto rounded-lg border border-black/[.08] dark:divide-white/[.06] dark:border-white/[.1]"
              >
                {preview.tokens.map((token) => (
                  <div
                    key={token}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="font-mono text-sm text-black dark:text-zinc-50">
                      {token}
                    </span>
                    <select
                      name={`wallet_${token}`}
                      required
                      defaultValue={cryptoDefault}
                      className="rounded-md border border-black/[.12] bg-white px-2 py-1 text-xs text-zinc-600 dark:border-white/[.16] dark:bg-black dark:text-zinc-300"
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

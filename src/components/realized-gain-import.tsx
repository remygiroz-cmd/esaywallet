"use client";

import { useActionState, useMemo, useState } from "react";
import {
  importRealizedGainsAction,
  deleteRealizedGainEntryAction,
  type RealizedImportState,
} from "@/app/(app)/transactions/realized-actions";
import { parseRealizedGainCsv } from "@/lib/import-realized";
import { formatCurrency, formatSignedCurrency } from "@/lib/format";
import { ui } from "@/lib/ui";
import { DeleteButton } from "./delete-button";

type WalletOption = {
  id: string;
  name: string;
  currency: string;
  type: string;
};

export type RealizedEntryRow = {
  id: string;
  year: number;
  securityName: string;
  securityCode: string | null;
  realizedGain: number;
  proceeds: number;
  source: string | null;
  walletName: string | null;
};

const initialState: RealizedImportState = {};

export function RealizedGainImport({
  wallets,
  entries,
}: {
  wallets: WalletOption[];
  entries: RealizedEntryRow[];
}) {
  const [state, formAction, pending] = useActionState(
    importRealizedGainsAction,
    initialState,
  );

  const ctoFirst = useMemo(() => {
    const cto = wallets.filter((w) => w.type === "CTO");
    const rest = wallets.filter((w) => w.type !== "CTO");
    return [...cto, ...rest];
  }, [wallets]);

  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [walletId, setWalletId] = useState(ctoFirst[0]?.id ?? "");
  const [year, setYear] = useState(new Date().getFullYear() - 1);

  const preview = useMemo(
    () => (text ? parseRealizedGainCsv(text) : null),
    [text],
  );

  const totals = useMemo(() => {
    if (!preview) return null;
    let gain = 0;
    let proceeds = 0;
    for (const row of preview.rows) {
      gain += row.realizedGain;
      proceeds += row.proceeds;
    }
    return { gain, proceeds };
  }, [preview]);

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFileName(file.name);
    file.text().then((content) => setText(content));
  }

  const payload = useMemo(
    () =>
      JSON.stringify({
        walletId,
        year,
        source: fileName,
        rows:
          preview?.rows.map((row) => ({
            securityName: row.name,
            securityCode: row.code,
            proceeds: row.proceeds,
            realizedGain: row.realizedGain,
          })) ?? [],
      }),
    [walletId, year, fileName, preview],
  );

  const entriesByYear = useMemo(() => {
    const map = new Map<number, RealizedEntryRow[]>();
    for (const entry of entries) {
      const list = map.get(entry.year);
      if (list) list.push(entry);
      else map.set(entry.year, [entry]);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [entries]);

  if (wallets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
        Créez d&apos;abord un wallet pour pouvoir importer un relevé.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className={`${ui.card} flex flex-col gap-4`}>
        <input type="hidden" name="payload" value={payload} />

        <label className={ui.label}>
          Relevé de plus-values (CSV de la banque)
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="w-full rounded-lg border border-black/[.12] bg-white px-3 py-2 text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white dark:border-white/[.16] dark:bg-black dark:text-zinc-300"
          />
          <span className="text-xs font-normal text-zinc-400">
            Le récapitulatif fiscal annuel d&apos;un CTO (libellé, code ISIN,
            +/- value réalisée, cessions). La banque a déjà fait le calcul du
            prix de revient — ces chiffres font foi pour la déclaration.
          </span>
        </label>

        <div className="flex flex-col gap-4 sm:flex-row">
          <label className={`${ui.label} flex-1`}>
            Wallet (CTO concerné)
            <select
              value={walletId}
              onChange={(event) => setWalletId(event.target.value)}
              className={ui.input}
            >
              {ctoFirst.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name} ({wallet.currency})
                </option>
              ))}
            </select>
          </label>
          <label className={`${ui.label} sm:w-40`}>
            Année fiscale
            <input
              type="number"
              min="1990"
              max="2100"
              value={year}
              onChange={(event) =>
                setYear(Number(event.target.value) || year)
              }
              className={ui.input}
            />
          </label>
        </div>

        {preview ? (
          <div className="rounded-lg border border-black/[.08] bg-zinc-50 p-3 text-sm dark:border-white/[.1] dark:bg-zinc-900">
            {preview.rows.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-400">
                Aucune ligne reconnue dans ce fichier. Vérifiez qu&apos;il
                contient bien une colonne « +/- value réalisée ».
              </p>
            ) : (
              <>
                <p className="font-medium text-zinc-700 dark:text-zinc-200">
                  {preview.rows.length} ligne
                  {preview.rows.length === 1 ? "" : "s"} ·{" "}
                  {totals
                    ? `+/- value totale ${formatSignedCurrency(
                        totals.gain,
                        "EUR",
                      )}`
                    : ""}
                  {preview.skipped > 0
                    ? ` · ${preview.skipped} ignorée${
                        preview.skipped === 1 ? "" : "s"
                      }`
                    : ""}
                </p>
                <ul className="mt-2 flex flex-col gap-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {preview.rows.slice(0, 6).map((row) => (
                    <li key={row.line} className="flex justify-between gap-3">
                      <span className="truncate">
                        {row.name}
                        {row.code ? ` · ${row.code}` : ""}
                      </span>
                      <span
                        className={
                          row.realizedGain >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }
                      >
                        {formatSignedCurrency(row.realizedGain, "EUR")}
                      </span>
                    </li>
                  ))}
                  {preview.rows.length > 6 ? (
                    <li className="text-zinc-400">
                      … et {preview.rows.length - 6} autre
                      {preview.rows.length - 6 === 1 ? "" : "s"}
                    </li>
                  ) : null}
                </ul>
              </>
            )}
          </div>
        ) : null}

        {state.error ? <p className={ui.errorText}>{state.error}</p> : null}
        {state.imported !== undefined ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            ✓ {state.imported} ligne{state.imported === 1 ? "" : "s"} importée
            {state.imported === 1 ? "" : "s"} — visible dans la page Fiscalité.
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={pending || !preview || preview.rows.length === 0}
            className={ui.primaryButton}
          >
            {pending
              ? "Import en cours…"
              : preview && preview.rows.length > 0
                ? `Importer ${preview.rows.length} ligne${
                    preview.rows.length === 1 ? "" : "s"
                  }`
                : "Importer le relevé"}
          </button>
        </div>
      </form>

      {entriesByYear.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Relevés déjà importés
          </p>
          {entriesByYear.map(([entryYear, yearEntries]) => {
            const yearGain = yearEntries.reduce(
              (sum, entry) => sum + entry.realizedGain,
              0,
            );
            return (
              <div key={entryYear} className={`${ui.card} p-0`}>
                <div className="flex items-center justify-between gap-3 border-b border-black/[.06] px-4 py-2.5 dark:border-white/[.08]">
                  <span className="text-sm font-semibold text-black dark:text-zinc-50">
                    {entryYear}
                  </span>
                  <span
                    className={`text-sm font-medium tabular-nums ${
                      yearGain >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatSignedCurrency(yearGain, "EUR")}
                  </span>
                </div>
                <ul className="divide-y divide-black/[.05] dark:divide-white/[.06]">
                  {yearEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-zinc-700 dark:text-zinc-200">
                          {entry.securityName}
                          {entry.securityCode ? (
                            <span className="ml-1 font-mono text-xs text-zinc-400">
                              {entry.securityCode}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {entry.walletName ?? "Wallet supprimé"} · cessions{" "}
                          {formatCurrency(entry.proceeds, "EUR")}
                          {entry.source ? ` · ${entry.source}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={`tabular-nums ${
                            entry.realizedGain >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {formatSignedCurrency(entry.realizedGain, "EUR")}
                        </span>
                        <DeleteButton
                          action={deleteRealizedGainEntryAction}
                          id={entry.id}
                          label="Suppr."
                          confirmMessage="Supprimer cette ligne de relevé ?"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

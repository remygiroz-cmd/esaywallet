"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  importTransactionsAction,
  type ImportFormState,
} from "@/app/(app)/transactions/actions";
import { parseTransactionRows } from "@/lib/import";
import { formatQuantity, formatDate } from "@/lib/format";
import { ui } from "@/lib/ui";

type WalletOption = { id: string; name: string; currency: string };
type AssetOption = { id: string; name: string; symbol: string };

const initialState: ImportFormState = {};

const EXAMPLE = `12/03/2025\t100\t0,00130778\t76465,46
05/10/2025\t-2089\t-0,01955\t106854,22`;

export function TransactionImport({
  wallets,
  assets,
}: {
  wallets: WalletOption[];
  assets: AssetOption[];
}) {
  const [state, formAction, pending] = useActionState(
    importTransactionsAction,
    initialState,
  );
  const [text, setText] = useState("");

  const preview = useMemo(() => parseTransactionRows(text), [text]);

  if (state.imported !== undefined) {
    return (
      <div className={`${ui.card} flex flex-col items-start gap-3`}>
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          ✓ {state.imported} transaction
          {state.imported === 1 ? "" : "s"} importée
          {state.imported === 1 ? "" : "s"} avec succès.
        </p>
        <Link href="/transactions" className={ui.primaryButton}>
          Voir mes transactions
        </Link>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
        Créez d&apos;abord l&apos;asset concerné (page Assets) avant
        d&apos;importer ses transactions.
      </div>
    );
  }

  return (
    <form action={formAction} className={`${ui.card} flex flex-col gap-4`}>
      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} flex-1`}>
          Wallet de destination
          <select
            name="walletId"
            required
            defaultValue={wallets[0]?.id ?? ""}
            className={ui.input}
          >
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name} ({wallet.currency})
              </option>
            ))}
          </select>
        </label>
        <label className={`${ui.label} flex-1`}>
          Asset concerné
          <select
            name="assetId"
            required
            defaultValue={assets[0]?.id ?? ""}
            className={ui.input}
          >
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} ({asset.symbol})
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={ui.label}>
        Données à importer
        <textarea
          name="data"
          rows={10}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={EXAMPLE}
          className={`${ui.input} font-mono text-xs`}
        />
        <span className="text-xs font-normal text-zinc-400">
          Une transaction par ligne, 4 colonnes séparées par des tabulations :
          <strong> Date · Montant investi · Quantité · Prix unitaire</strong>.
          Un montant ou une quantité négatif = une vente.
        </span>
      </label>

      {text.trim() ? (
        <div className="rounded-lg border border-black/[.08] bg-zinc-50 p-3 text-sm dark:border-white/[.1] dark:bg-zinc-900">
          <p className="font-medium text-zinc-700 dark:text-zinc-200">
            {preview.rows.length} transaction
            {preview.rows.length === 1 ? "" : "s"} détectée
            {preview.rows.length === 1 ? "" : "s"}
            {preview.skipped.length > 0
              ? ` · ${preview.skipped.length} ligne${
                  preview.skipped.length === 1 ? "" : "s"
                } ignorée${preview.skipped.length === 1 ? "" : "s"}`
              : ""}
          </p>
          {preview.rows.length > 0 ? (
            <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[26rem] text-xs">
              <thead>
                <tr className="text-left text-zinc-400">
                  <th className="py-1 font-medium">Date</th>
                  <th className="py-1 font-medium">Type</th>
                  <th className="py-1 text-right font-medium">Quantité</th>
                  <th className="py-1 text-right font-medium">Prix</th>
                  <th className="py-1 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 5).map((row) => (
                  <tr
                    key={row.line}
                    className="border-t border-black/[.05] dark:border-white/[.06]"
                  >
                    <td className="py-1 text-zinc-600 dark:text-zinc-300">
                      {formatDate(row.executedAt)}
                    </td>
                    <td className="py-1 text-zinc-600 dark:text-zinc-300">
                      {row.type === "SELL" ? "Vente" : "Achat"}
                    </td>
                    <td className="py-1 text-right text-zinc-600 dark:text-zinc-300">
                      {formatQuantity(row.quantity)}
                    </td>
                    <td className="py-1 text-right text-zinc-600 dark:text-zinc-300">
                      {row.unitPrice}
                    </td>
                    <td className="py-1 text-right text-zinc-600 dark:text-zinc-300">
                      {row.amountInvested}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : null}
          {preview.rows.length > 5 ? (
            <p className="mt-1 text-xs text-zinc-400">
              … et {preview.rows.length - 5} autre
              {preview.rows.length - 5 === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>
      ) : null}

      {state.error ? <p className={ui.errorText}>{state.error}</p> : null}

      <div>
        <button
          type="submit"
          disabled={pending || preview.rows.length === 0}
          className={ui.primaryButton}
        >
          {pending
            ? "Import en cours…"
            : `Importer ${preview.rows.length} transaction${
                preview.rows.length === 1 ? "" : "s"
              }`}
        </button>
      </div>
    </form>
  );
}

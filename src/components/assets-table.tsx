"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  deleteAssetAction,
  mergeAssetsAction,
  type MergeAssetsState,
} from "@/app/(app)/assets/actions";
import { ASSET_TYPE_LABELS, type AssetType } from "@/lib/constants";
import { ui } from "@/lib/ui";
import { DeleteButton } from "./delete-button";

export type AssetRow = {
  id: string;
  name: string;
  symbol: string;
  type: string;
  quoteCurrency: string;
  coingeckoId: string | null;
  yahooSymbol: string | null;
  transactionCount: number;
  incomeCount: number;
  priceAlertCount: number;
};

const initialState: MergeAssetsState = {};

export function AssetsTable({ assets }: { assets: AssetRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetId, setTargetId] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    mergeAssetsAction,
    initialState,
  );

  const selectedAssets = useMemo(
    () => assets.filter((asset) => selected.has(asset.id)),
    [assets, selected],
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Drop the target when it leaves the selection.
      if (targetId && !next.has(targetId)) setTargetId(null);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setTargetId(null);
  }

  // Reset after a successful merge — the page revalidates and the rows that
  // were merged in disappear, so we drop the local selection.
  useEffect(() => {
    if (state.mergedAt) {
      setSelected(new Set());
      setTargetId(null);
    }
  }, [state.mergedAt]);

  const canMerge = selected.size >= 2;
  const movedTransactions = selectedAssets
    .filter((asset) => asset.id !== targetId)
    .reduce((sum, asset) => sum + asset.transactionCount, 0);
  const movedIncome = selectedAssets
    .filter((asset) => asset.id !== targetId)
    .reduce((sum, asset) => sum + asset.incomeCount, 0);
  const movedAlerts = selectedAssets
    .filter((asset) => asset.id !== targetId)
    .reduce((sum, asset) => sum + asset.priceAlertCount, 0);

  return (
    <div className="flex flex-col gap-3">
      {canMerge ? (
        <form
          action={formAction}
          className={`${ui.card} flex flex-col gap-4 border-emerald-200 dark:border-emerald-900/60`}
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Fusionner {selected.size} assets
            </p>
            <p className={ui.subtle}>
              Choisis l&apos;asset à conserver. Les transactions, revenus et
              alertes des autres seront rattachés à celui-ci, puis ces assets
              seront supprimés.
            </p>
          </div>

          <ul className="flex flex-col gap-2">
            {selectedAssets.map((asset) => (
              <li key={asset.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.12]">
                  <input
                    type="radio"
                    name="targetId"
                    value={asset.id}
                    checked={targetId === asset.id}
                    onChange={() => setTargetId(asset.id)}
                    className="size-4 accent-emerald-600"
                  />
                  <span className="flex-1">
                    <span className="font-medium text-black dark:text-zinc-50">
                      {asset.name}
                    </span>{" "}
                    <span className="font-mono text-xs text-zinc-500">
                      {asset.symbol}
                    </span>
                    <span className={`ml-2 ${ui.subtle}`}>
                      {ASSET_TYPE_LABELS[asset.type as AssetType] ?? asset.type}
                      {" · "}
                      {asset.transactionCount} tx
                      {asset.incomeCount > 0
                        ? ` · ${asset.incomeCount} revenu${asset.incomeCount > 1 ? "s" : ""}`
                        : ""}
                      {asset.priceAlertCount > 0
                        ? ` · ${asset.priceAlertCount} alerte${asset.priceAlertCount > 1 ? "s" : ""}`
                        : ""}
                    </span>
                  </span>
                </label>
                {targetId !== asset.id ? (
                  <input
                    type="hidden"
                    name="sourceIds"
                    value={asset.id}
                  />
                ) : null}
              </li>
            ))}
          </ul>

          {targetId ? (
            <p className={ui.subtle}>
              À déplacer vers l&apos;asset gardé&nbsp;: {movedTransactions}{" "}
              transaction{movedTransactions > 1 ? "s" : ""}
              {movedIncome > 0
                ? `, ${movedIncome} revenu${movedIncome > 1 ? "s" : ""}`
                : ""}
              {movedAlerts > 0
                ? `, ${movedAlerts} alerte${movedAlerts > 1 ? "s" : ""}`
                : ""}
              .
            </p>
          ) : null}

          {state.error ? <p className={ui.errorText}>{state.error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending || !targetId}
              className={ui.primaryButton}
              onClick={(event) => {
                if (
                  !window.confirm(
                    `Fusionner ${selected.size - 1} asset${
                      selected.size - 1 > 1 ? "s" : ""
                    } dans l'asset gardé ? Cette action est irréversible.`,
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              {pending ? "Fusion…" : "Fusionner"}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className={ui.secondaryButton}
            >
              Annuler
            </button>
          </div>
        </form>
      ) : selected.size === 1 ? (
        <div className={`${ui.subtle} px-1`}>
          Sélectionne au moins un autre asset pour activer la fusion.
        </div>
      ) : null}

      <div className={`${ui.card} overflow-x-auto p-0`}>
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Symbole</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Cotation</th>
              <th className="px-4 py-3 font-medium">Identifiant prix</th>
              <th className="px-4 py-3 font-medium">Transactions</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const externalId =
                asset.type === "CRYPTO" ? asset.coingeckoId : asset.yahooSymbol;
              const checked = selected.has(asset.id);
              return (
                <tr
                  key={asset.id}
                  className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(asset.id)}
                      aria-label={`Sélectionner ${asset.name}`}
                      className="size-4 accent-emerald-600"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/assets/${asset.id}`}
                      className="font-medium text-black hover:text-emerald-600 dark:text-zinc-50 dark:hover:text-emerald-400"
                    >
                      {asset.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                    {asset.symbol}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {ASSET_TYPE_LABELS[asset.type as AssetType] ?? asset.type}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {asset.quoteCurrency}
                  </td>
                  <td className="px-4 py-3">
                    {externalId ? (
                      <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
                        {externalId}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        non renseigné
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {asset.transactionCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {asset.transactionCount === 0 ? (
                      <DeleteButton
                        action={deleteAssetAction}
                        id={asset.id}
                        confirmMessage={`Supprimer l'asset « ${asset.name} » ?`}
                      />
                    ) : (
                      <Link
                        href={`/assets/${asset.id}`}
                        className="text-xs text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                      >
                        Modifier
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

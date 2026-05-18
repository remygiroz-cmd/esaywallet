"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  deleteTransactionsBulkAction,
  type BulkDeleteState,
} from "@/app/(app)/transactions/actions";
import { formatCurrency, formatQuantity, formatDate } from "@/lib/format";
import { ui } from "@/lib/ui";
import { TransactionTypeBadge } from "./transaction-type-badge";

export type TransactionRow = {
  id: string;
  executedAt: string;
  type: string;
  assetName: string;
  assetSymbol: string;
  walletName: string;
  quantity: number;
  unitPrice: number;
  quoteCurrency: string;
  amountInvested: number;
  walletCurrency: string;
};

type SortKey = "date" | "asset" | "wallet" | "amount";
type SortDirection = "asc" | "desc";

const initialState: BulkDeleteState = {};

export function TransactionTable({
  rows,
  showWallet,
}: {
  rows: TransactionRow[];
  showWallet: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    deleteTransactionsBulkAction,
    initialState,
  );

  // After a successful bulk delete the action returns a fresh `submittedAt`,
  // which remounts the body and clears the selection.
  return (
    <TransactionTableBody
      key={state.submittedAt ?? "initial"}
      rows={rows}
      showWallet={showWallet}
      formAction={formAction}
      pending={pending}
    />
  );
}

function TransactionTableBody({
  rows,
  showWallet,
  formAction,
  pending,
}: {
  rows: TransactionRow[];
  showWallet: boolean;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Default: most recent first — matches the server-side query order.
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedRows = useMemo(() => {
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const primary = compareBy(a, b, sortKey);
      if (primary !== 0) return primary * dir;
      // Stable tiebreaker so visually identical rows keep their newest-first order.
      return compareBy(a, b, "date") * -1;
    });
  }, [rows, sortKey, sortDirection]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // First click on the date column defaults to newest-first; other
      // columns default to ascending (A→Z, smallest→largest).
      setSortDirection(key === "date" ? "desc" : "asc");
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)),
    );
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Supprimer ${selected.size} transaction${
              selected.size > 1 ? "s" : ""
            } ? Cette action est irréversible.`,
          )
        ) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-3"
    >
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 dark:border-emerald-900/60 dark:bg-emerald-950/50">
          <span className="text-sm text-emerald-800 dark:text-emerald-200">
            {selected.size} transaction{selected.size > 1 ? "s" : ""}{" "}
            sélectionnée{selected.size > 1 ? "s" : ""}
          </span>
          <button
            type="submit"
            disabled={pending}
            className={ui.dangerButton}
          >
            {pending ? "Suppression…" : "Supprimer la sélection"}
          </button>
        </div>
      ) : null}

      <div className={`${ui.card} overflow-x-auto p-0`}>
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Tout sélectionner"
                  className="align-middle"
                />
              </th>
              <SortableHeader
                label="Date"
                columnKey="date"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <th className="px-4 py-3 font-medium">Type</th>
              <SortableHeader
                label="Asset"
                columnKey="asset"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              {showWallet ? (
                <SortableHeader
                  label="Wallet"
                  columnKey="wallet"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              ) : null}
              <th className="px-4 py-3 text-right font-medium">Quantité</th>
              <th className="px-4 py-3 text-right font-medium">
                Prix unitaire
              </th>
              <SortableHeader
                label="Montant"
                columnKey="amount"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                align="right"
              />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-black/[.05] last:border-0 dark:border-white/[.06] ${
                  selected.has(row.id)
                    ? "bg-emerald-50/60 dark:bg-emerald-950/30"
                    : ""
                }`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    aria-label="Sélectionner la transaction"
                    className="align-middle"
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                  {formatDate(row.executedAt)}
                </td>
                <td className="px-4 py-3">
                  <TransactionTypeBadge type={row.type} />
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-black dark:text-zinc-50">
                    {row.assetName}
                  </span>{" "}
                  <span className="font-mono text-xs text-zinc-400">
                    {row.assetSymbol}
                  </span>
                </td>
                {showWallet ? (
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {row.walletName}
                  </td>
                ) : null}
                <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                  {formatQuantity(row.quantity)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                  {formatCurrency(row.unitPrice, row.quoteCurrency)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-black dark:text-zinc-50">
                  {formatCurrency(row.amountInvested, row.walletCurrency)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/transactions/${row.id}`}
                    className="text-xs text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                  >
                    Modifier
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}

function compareBy(a: TransactionRow, b: TransactionRow, key: SortKey): number {
  switch (key) {
    case "date":
      return a.executedAt.localeCompare(b.executedAt);
    case "asset":
      return a.assetName.localeCompare(b.assetName, "fr", {
        sensitivity: "base",
      });
    case "wallet":
      return a.walletName.localeCompare(b.walletName, "fr", {
        sensitivity: "base",
      });
    case "amount":
      return a.amountInvested - b.amountInvested;
  }
}

function SortableHeader({
  label,
  columnKey,
  sortKey,
  sortDirection,
  onSort,
  align = "left",
}: {
  label: string;
  columnKey: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = columnKey === sortKey;
  const arrow = !active ? "↕" : sortDirection === "asc" ? "↑" : "↓";
  return (
    <th className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-emerald-600 dark:hover:text-emerald-400 ${
          active ? "text-emerald-700 dark:text-emerald-300" : ""
        }`}
        aria-label={`Trier par ${label}`}
      >
        <span>{label}</span>
        <span
          aria-hidden
          className={`text-[0.7rem] ${active ? "" : "text-zinc-300 dark:text-zinc-600"}`}
        >
          {arrow}
        </span>
      </button>
    </th>
  );
}

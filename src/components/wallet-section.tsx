"use client";

import { useState } from "react";
import type { WalletComputation, WalletAssetLine } from "@/lib/portfolio";
import { moveAssetWalletAction } from "@/app/(app)/transactions/actions";
import { WALLET_TYPE_LABELS, type WalletType } from "@/lib/constants";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { ui } from "@/lib/ui";
import { GainBadge } from "./gain-badge";

type DragPayload = { assetId: string; fromWalletId: string };

export function WalletSection({
  wallets,
  onMoved,
}: {
  wallets: WalletComputation[];
  onMoved: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draggingFrom, setDraggingFrom] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(walletId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(walletId)) next.delete(walletId);
      else next.add(walletId);
      return next;
    });
  }

  async function move(
    assetId: string,
    fromWalletId: string,
    toWalletId: string,
  ) {
    if (fromWalletId === toWalletId) return;
    setMoving(true);
    setError(null);
    const result = await moveAssetWalletAction(
      assetId,
      fromWalletId,
      toWalletId,
    );
    setMoving(false);
    if (result.ok) {
      onMoved();
    } else {
      setError(result.error ?? "Déplacement impossible.");
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Par wallet
        </h2>
        {moving ? (
          <span className="text-xs text-zinc-400">Déplacement…</span>
        ) : null}
      </div>

      <p className="text-xs text-zinc-400">
        Déroulez une carte pour voir ses assets. Glissez-déposez un asset sur
        un autre wallet (ou utilisez le menu « Déplacer ») pour le réassigner.
      </p>

      {error ? <p className={ui.errorText}>{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {wallets.map((wallet) => (
          <WalletCard
            key={wallet.walletId}
            wallet={wallet}
            allWallets={wallets}
            expanded={expanded.has(wallet.walletId)}
            isDragSource={draggingFrom === wallet.walletId}
            isDropTarget={
              dragOver === wallet.walletId &&
              draggingFrom !== null &&
              draggingFrom !== wallet.walletId
            }
            onToggle={() => toggle(wallet.walletId)}
            onAssetDragStart={() => setDraggingFrom(wallet.walletId)}
            onAssetDragEnd={() => {
              setDraggingFrom(null);
              setDragOver(null);
            }}
            onCardDragOver={() => setDragOver(wallet.walletId)}
            onCardDrop={(payload) => {
              setDraggingFrom(null);
              setDragOver(null);
              move(payload.assetId, payload.fromWalletId, wallet.walletId);
            }}
            onMove={move}
          />
        ))}
      </div>
    </section>
  );
}

function WalletCard({
  wallet,
  allWallets,
  expanded,
  isDragSource,
  isDropTarget,
  onToggle,
  onAssetDragStart,
  onAssetDragEnd,
  onCardDragOver,
  onCardDrop,
  onMove,
}: {
  wallet: WalletComputation;
  allWallets: WalletComputation[];
  expanded: boolean;
  isDragSource: boolean;
  isDropTarget: boolean;
  onToggle: () => void;
  onAssetDragStart: () => void;
  onAssetDragEnd: () => void;
  onCardDragOver: () => void;
  onCardDrop: (payload: DragPayload) => void;
  onMove: (assetId: string, from: string, to: string) => void;
}) {
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onCardDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        try {
          const payload = JSON.parse(
            event.dataTransfer.getData("text/plain"),
          ) as DragPayload;
          if (payload.assetId && payload.fromWalletId) onCardDrop(payload);
        } catch {
          // ignore malformed drops
        }
      }}
      className={`${ui.card} flex flex-col gap-3 transition-colors ${
        isDropTarget
          ? "border-emerald-500 ring-2 ring-emerald-500/40"
          : isDragSource
            ? "opacity-60"
            : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex items-start justify-between gap-2 text-left"
      >
        <div>
          <span className="font-semibold text-black dark:text-zinc-50">
            <span className="mr-1 text-zinc-400">
              {expanded ? "▾" : "▸"}
            </span>
            {wallet.name}
          </span>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {WALLET_TYPE_LABELS[wallet.type as WalletType] ?? wallet.type} ·{" "}
            {wallet.assets.length} asset
            {wallet.assets.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {wallet.currency}
        </span>
      </button>

      <div>
        <p className="text-xl font-semibold text-black tabular-nums dark:text-zinc-50">
          {formatCurrency(wallet.currentValue, wallet.currency)}
        </p>
        <div className="mt-1">
          <GainBadge
            gain={wallet.gain}
            gainPct={wallet.gainPct}
            currency={wallet.currency}
            size="sm"
          />
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Investi : {formatCurrency(wallet.totalCost, wallet.currency)}
      </p>
      {wallet.realizedGain !== 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Réalisé : {formatCurrency(wallet.realizedGain, wallet.currency)}
          {wallet.estimatedTax > 0
            ? ` · impôt estimé ${formatCurrency(
                wallet.estimatedTax,
                wallet.currency,
              )}`
            : ""}
        </p>
      ) : null}

      {expanded ? (
        <div className="flex flex-col gap-1.5 border-t border-black/[.06] pt-3 dark:border-white/[.08]">
          {wallet.assets.length === 0 ? (
            <p className="text-xs text-zinc-400">
              Aucun asset détenu dans ce wallet.
            </p>
          ) : (
            wallet.assets.map((line) => (
              <WalletAssetRow
                key={line.assetId}
                line={line}
                wallet={wallet}
                allWallets={allWallets}
                onAssetDragStart={onAssetDragStart}
                onAssetDragEnd={onAssetDragEnd}
                onMove={onMove}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function WalletAssetRow({
  line,
  wallet,
  allWallets,
  onAssetDragStart,
  onAssetDragEnd,
  onMove,
}: {
  line: WalletAssetLine;
  wallet: WalletComputation;
  allWallets: WalletComputation[];
  onAssetDragStart: () => void;
  onAssetDragEnd: () => void;
  onMove: (assetId: string, from: string, to: string) => void;
}) {
  const otherWallets = allWallets.filter(
    (candidate) => candidate.walletId !== wallet.walletId,
  );

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(
          "text/plain",
          JSON.stringify({
            assetId: line.assetId,
            fromWalletId: wallet.walletId,
          }),
        );
        event.dataTransfer.effectAllowed = "move";
        onAssetDragStart();
      }}
      onDragEnd={onAssetDragEnd}
      className="flex cursor-grab items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 active:cursor-grabbing dark:hover:bg-zinc-900"
    >
      <div className="min-w-0">
        <span className="text-zinc-300 dark:text-zinc-600">⠿</span>{" "}
        <span className="text-sm font-medium text-black dark:text-zinc-50">
          {line.name}
        </span>{" "}
        <span className="font-mono text-xs text-zinc-400">{line.symbol}</span>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {formatQuantity(line.quantity)} ·{" "}
          {formatCurrency(line.currentValue, wallet.currency)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <GainBadge
          gain={line.gain}
          gainPct={line.gainPct}
          currency={wallet.currency}
          size="sm"
        />
        {otherWallets.length > 0 ? (
          <select
            aria-label="Déplacer vers un autre wallet"
            value=""
            onChange={(event) => {
              if (event.target.value) {
                onMove(line.assetId, wallet.walletId, event.target.value);
              }
            }}
            className="rounded-md border border-black/[.12] bg-white px-1.5 py-1 text-xs text-zinc-500 dark:border-white/[.16] dark:bg-black dark:text-zinc-400"
          >
            <option value="">Déplacer…</option>
            {otherWallets.map((target) => (
              <option key={target.walletId} value={target.walletId}>
                → {target.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}

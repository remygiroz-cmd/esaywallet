"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  PortfolioComputation,
  WalletComputation,
  AssetComputation,
  SaleComputation,
  PortfolioSnapshotPoint,
} from "@/lib/portfolio";
import {
  WALLET_TYPE_LABELS,
  ASSET_TYPE_LABELS,
  type WalletType,
  type AssetType,
} from "@/lib/constants";
import {
  formatCurrency,
  formatQuantity,
  formatDate,
  formatDateTime,
  formatSignedCurrency,
} from "@/lib/format";
import { ui } from "@/lib/ui";
import { GainBadge } from "./gain-badge";
import { PortfolioChart } from "./portfolio-chart";

type DashboardResponse = {
  portfolio: PortfolioComputation;
  history: PortfolioSnapshotPoint[];
  refresh: { refreshedAt: string; updated: number; errors: string[] };
};

async function fetchDashboard(): Promise<DashboardResponse> {
  const res = await fetch("/api/dashboard");
  if (!res.ok) {
    throw new Error("Impossible de charger le tableau de bord.");
  }
  return res.json();
}

export function DashboardLive({
  initialPortfolio,
  initialHistory,
}: {
  initialPortfolio: PortfolioComputation;
  initialHistory: PortfolioSnapshotPoint[];
}) {
  const { data, isFetching, isPlaceholderData, refetch } =
    useQuery<DashboardResponse>({
      queryKey: ["dashboard"],
      queryFn: fetchDashboard,
      refetchInterval: 60_000,
      placeholderData: {
        portfolio: initialPortfolio,
        history: initialHistory,
        refresh: {
          refreshedAt: initialPortfolio.generatedAt,
          updated: 0,
          errors: [],
        },
      },
    });

  // `data` is always defined here thanks to placeholderData.
  const { portfolio, history, refresh } = data as DashboardResponse;
  const hasTransactions = portfolio.assets.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={ui.heading}>Tableau de bord</h1>
          <p className={`mt-1 ${ui.subtle}`}>
            {isPlaceholderData
              ? "Récupération des prix en direct…"
              : `Dernière mise à jour : ${formatDateTime(portfolio.generatedAt)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className={ui.secondaryButton}
        >
          {isFetching ? "Actualisation…" : "Actualiser"}
        </button>
      </header>

      {portfolio.wallets.length === 0 ? (
        <EmptyState
          message="Commencez par créer un wallet."
          href="/wallets"
          cta="Créer un wallet"
        />
      ) : !hasTransactions ? (
        <EmptyState
          message="Aucune transaction enregistrée. Ajoutez votre premier achat pour suivre vos plus-values."
          href="/transactions"
          cta="Ajouter une transaction"
        />
      ) : (
        <>
          {refresh.errors.length > 0 || portfolio.hasMissingPrice ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200">
              <p className="font-medium">
                Certains prix n&apos;ont pas pu être récupérés.
              </p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                Les lignes concernées sont considérées comme stables.
                Vérifiez les identifiants externes sur la page Assets.
              </p>
              {refresh.errors.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">
                  {refresh.errors.slice(0, 5).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <GlobalSummary portfolio={portfolio} />

          {portfolio.realizedGain !== 0 || portfolio.estimatedTax > 0 ? (
            <RealizedSummary portfolio={portfolio} />
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Évolution
            </h2>
            <PortfolioChart
              history={history}
              currency={portfolio.referenceCurrency}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Par wallet
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {portfolio.wallets.map((wallet) => (
                <WalletCard key={wallet.walletId} wallet={wallet} />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Par asset
            </h2>
            <div className="flex flex-col gap-2">
              {portfolio.assets.map((asset) => (
                <AssetRow
                  key={asset.assetId}
                  asset={asset}
                  referenceCurrency={portfolio.referenceCurrency}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function EmptyState({
  message,
  href,
  cta,
}: {
  message: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-black/[.15] bg-white p-10 text-center dark:border-white/[.15] dark:bg-zinc-950">
      <p className={ui.subtle}>{message}</p>
      <Link href={href} className={ui.primaryButton}>
        {cta}
      </Link>
    </div>
  );
}

function GlobalSummary({ portfolio }: { portfolio: PortfolioComputation }) {
  const currency = portfolio.referenceCurrency;
  return (
    <div className="rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.12] dark:bg-zinc-950">
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
        Patrimoine global
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-black tabular-nums dark:text-zinc-50">
            {formatCurrency(portfolio.currentValue, currency)}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Valeur actuelle
          </p>
        </div>
        <div>
          <GainBadge
            gain={portfolio.gain}
            gainPct={portfolio.gainPct}
            currency={currency}
            size="lg"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Plus / moins-value
          </p>
        </div>
        <div>
          <p className="text-base font-medium text-zinc-600 tabular-nums dark:text-zinc-300">
            {formatCurrency(portfolio.totalCost, currency)}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Total investi
          </p>
        </div>
      </div>
    </div>
  );
}

function RealizedSummary({ portfolio }: { portfolio: PortfolioComputation }) {
  const currency = portfolio.referenceCurrency;
  return (
    <div className="rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.12] dark:bg-zinc-950">
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
        Réalisé &amp; fiscalité
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              portfolio.realizedGain >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {formatSignedCurrency(portfolio.realizedGain, currency)}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Plus / moins-value réalisée
          </p>
        </div>
        <div>
          <p className="text-base font-medium text-zinc-600 tabular-nums dark:text-zinc-300">
            {formatCurrency(portfolio.estimatedTax, currency)}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Impôt estimé
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-400">
        Estimation indicative (PFU 30 % en CTO/crypto, 17,2 % en PEA). La
        fiscalité réelle dépend de votre situation et de la durée de
        détention.
      </p>
    </div>
  );
}

function WalletCard({ wallet }: { wallet: WalletComputation }) {
  return (
    <div className={`${ui.card} flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link
            href={`/wallets/${wallet.walletId}`}
            className="font-semibold text-black hover:text-emerald-600 dark:text-zinc-50 dark:hover:text-emerald-400"
          >
            {wallet.name}
          </Link>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {WALLET_TYPE_LABELS[wallet.type as WalletType] ?? wallet.type}
          </p>
        </div>
        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {wallet.currency}
        </span>
      </div>
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
          Réalisé : {formatSignedCurrency(wallet.realizedGain, wallet.currency)}
          {wallet.estimatedTax > 0
            ? ` · impôt estimé ${formatCurrency(wallet.estimatedTax, wallet.currency)}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

function AssetRow({
  asset,
  referenceCurrency,
}: {
  asset: AssetComputation;
  referenceCurrency: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`${ui.card} p-0`}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-zinc-400">{expanded ? "▾" : "▸"}</span>
          <div>
            <span className="font-semibold text-black dark:text-zinc-50">
              {asset.name}
            </span>{" "}
            <span className="font-mono text-xs text-zinc-400">
              {asset.symbol}
            </span>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {ASSET_TYPE_LABELS[asset.type as AssetType] ?? asset.type} ·{" "}
              {formatQuantity(asset.totalQuantity)} unité
              {asset.totalQuantity > 1 ? "s" : ""}
              {asset.currentPrice !== null && asset.currentPriceCurrency
                ? ` · cours ${formatCurrency(asset.currentPrice, asset.currentPriceCurrency)}`
                : " · cours indisponible"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold text-black tabular-nums dark:text-zinc-50">
            {formatCurrency(asset.currentValue, referenceCurrency)}
          </p>
          <GainBadge
            gain={asset.gain}
            gainPct={asset.gainPct}
            currency={referenceCurrency}
            size="sm"
          />
          {asset.hasSales ? (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Réalisé :{" "}
              {formatSignedCurrency(asset.realizedGain, referenceCurrency)}
            </p>
          ) : null}
        </div>
      </button>

      {expanded ? (
        <div className="flex flex-col gap-4 border-t border-black/[.06] px-5 py-3 dark:border-white/[.08]">
          <div className="overflow-x-auto">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
              Achats
            </p>
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Wallet</th>
                  <th className="py-2 text-right font-medium">Quantité</th>
                  <th className="py-2 text-right font-medium">Investi</th>
                  <th className="py-2 text-right font-medium">Valeur</th>
                  <th className="py-2 text-right font-medium">+/- value</th>
                </tr>
              </thead>
              <tbody>
                {asset.lots.map((lot) => (
                  <tr
                    key={lot.transactionId}
                    className="border-t border-black/[.04] dark:border-white/[.05]"
                  >
                    <td className="py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {formatDate(lot.executedAt)}
                    </td>
                    <td className="py-2 text-zinc-600 dark:text-zinc-300">
                      {lot.walletName}
                    </td>
                    <td className="py-2 text-right text-zinc-600 dark:text-zinc-300">
                      {formatQuantity(lot.quantity)}
                    </td>
                    <td className="py-2 text-right text-zinc-600 dark:text-zinc-300">
                      {formatCurrency(lot.costBasis, lot.walletCurrency)}
                    </td>
                    <td className="py-2 text-right text-zinc-600 dark:text-zinc-300">
                      {lot.currentValue !== null
                        ? formatCurrency(lot.currentValue, lot.walletCurrency)
                        : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {lot.gain !== null && lot.gainPct !== null ? (
                        <GainBadge
                          gain={lot.gain}
                          gainPct={lot.gainPct}
                          currency={lot.walletCurrency}
                          size="sm"
                        />
                      ) : (
                        <span className="text-xs text-zinc-400">
                          prix indisponible
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {asset.sales.length > 0 ? (
            <SalesTable sales={asset.sales} />
          ) : null}

          {asset.hasSales ? (
            <p className="text-xs text-zinc-400">
              Cette position comporte des ventes : la valeur de chaque achat
              ci-dessus est indicative (aux cours actuels), tandis que les
              agrégats utilisent le prix moyen pondéré.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SalesTable({ sales }: { sales: SaleComputation[] }) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
        Ventes
      </p>
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-zinc-400">
            <th className="py-2 font-medium">Date</th>
            <th className="py-2 font-medium">Wallet</th>
            <th className="py-2 text-right font-medium">Quantité</th>
            <th className="py-2 text-right font-medium">Reçu</th>
            <th className="py-2 text-right font-medium">Coût (PMP)</th>
            <th className="py-2 text-right font-medium">+/- value réalisée</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr
              key={sale.transactionId}
              className="border-t border-black/[.04] dark:border-white/[.05]"
            >
              <td className="py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                {formatDate(sale.executedAt)}
              </td>
              <td className="py-2 text-zinc-600 dark:text-zinc-300">
                {sale.walletName}
              </td>
              <td className="py-2 text-right text-zinc-600 dark:text-zinc-300">
                {formatQuantity(sale.quantity)}
              </td>
              <td className="py-2 text-right text-zinc-600 dark:text-zinc-300">
                {formatCurrency(sale.proceeds, sale.walletCurrency)}
              </td>
              <td className="py-2 text-right text-zinc-600 dark:text-zinc-300">
                {formatCurrency(sale.costOfSold, sale.walletCurrency)}
              </td>
              <td className="py-2 text-right">
                <GainBadge
                  gain={sale.realizedGain}
                  gainPct={sale.realizedGainPct}
                  currency={sale.walletCurrency}
                  size="sm"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

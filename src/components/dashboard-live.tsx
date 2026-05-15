"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  PortfolioComputation,
  AssetComputation,
  SaleComputation,
  PortfolioSnapshotPoint,
} from "@/lib/portfolio";
import type { TriggeredAlert } from "@/lib/alerts";
import { dismissAlertAction } from "@/app/(app)/alertes/actions";
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  ALERT_DIRECTION_LABELS,
  type AssetType,
} from "@/lib/constants";
import {
  formatCurrency,
  formatQuantity,
  formatDate,
  formatDateTime,
  formatSignedCurrency,
  formatPercent,
} from "@/lib/format";
import { ui } from "@/lib/ui";
import { GainBadge } from "./gain-badge";
import { PortfolioChart } from "./portfolio-chart";
import { AssetPriceChart } from "./asset-price-chart";
import { WalletSection } from "./wallet-section";
import { AllocationSection } from "./allocation-section";

type DashboardResponse = {
  portfolio: PortfolioComputation;
  history: PortfolioSnapshotPoint[];
  income: Record<string, number>;
  alerts: TriggeredAlert[];
};

type RefreshResult = {
  refreshedAt: string;
  updated: number;
  errors: string[];
};

async function fetchDashboard(): Promise<DashboardResponse> {
  const res = await fetch("/api/dashboard");
  if (!res.ok) {
    throw new Error("Impossible de charger le tableau de bord.");
  }
  return res.json();
}

async function triggerRefresh(): Promise<RefreshResult> {
  const res = await fetch("/api/prices/refresh", { method: "POST" });
  if (!res.ok) {
    return { refreshedAt: new Date().toISOString(), updated: 0, errors: [] };
  }
  return res.json();
}

export function DashboardLive({
  initialPortfolio,
  initialHistory,
  initialIncome,
  initialAlerts,
}: {
  initialPortfolio: PortfolioComputation;
  initialHistory: PortfolioSnapshotPoint[];
  initialIncome: Record<string, number>;
  initialAlerts: TriggeredAlert[];
}) {
  const { data, isFetching, isPlaceholderData, refetch } =
    useQuery<DashboardResponse>({
      queryKey: ["dashboard"],
      queryFn: fetchDashboard,
      refetchInterval: 60_000,
      placeholderData: {
        portfolio: initialPortfolio,
        history: initialHistory,
        income: initialIncome,
        alerts: initialAlerts,
      },
    });

  // The dashboard endpoint returns cached data instantly; the price
  // refresh runs in parallel and triggers a refetch when it completes,
  // so the UI is interactive immediately and converges to fresh prices
  // a couple of seconds later.
  const [refresh, setRefresh] = useState<RefreshResult>({
    refreshedAt: initialPortfolio.generatedAt,
    updated: 0,
    errors: [],
  });
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const result = await triggerRefresh();
      if (cancelled) return;
      setRefresh(result);
      refetch();
    }
    tick();
    const interval = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refetch]);

  // `data` is always defined here thanks to placeholderData.
  const { portfolio, history, income, alerts } = data as DashboardResponse;
  const hasTransactions = portfolio.assets.length > 0;

  // The "focused" wallet: its card is expanded and the assets list below
  // is filtered to it. null = no focus (everything shown).
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(
    null,
  );

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
          onClick={async () => {
            const result = await triggerRefresh();
            setRefresh(result);
            refetch();
          }}
          disabled={isFetching}
          className={ui.secondaryButton}
        >
          {isFetching ? "Actualisation…" : "Actualiser"}
        </button>
      </header>

      {alerts.length > 0 ? (
        <AlertsBanner alerts={alerts} onChange={() => refetch()} />
      ) : null}

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

          {Object.keys(income).length > 0 ? (
            <IncomeSummary income={income} />
          ) : null}

          <AllocationSection
            wallets={portfolio.wallets}
            assets={portfolio.assets}
            referenceCurrency={portfolio.referenceCurrency}
          />

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Évolution
            </h2>
            <PortfolioChart
              history={history}
              currency={portfolio.referenceCurrency}
            />
          </section>

          <WalletSection
            wallets={portfolio.wallets}
            selectedWalletId={selectedWalletId}
            onSelectWallet={setSelectedWalletId}
            onMoved={() => refetch()}
          />

          <AssetSection
            assets={portfolio.assets}
            wallets={portfolio.wallets.map((wallet) => ({
              walletId: wallet.walletId,
              name: wallet.name,
            }))}
            referenceCurrency={portfolio.referenceCurrency}
            selectedWalletId={selectedWalletId}
            onSelectWallet={setSelectedWalletId}
          />
        </>
      )}
    </div>
  );
}

function AssetSection({
  assets,
  wallets,
  referenceCurrency,
  selectedWalletId,
  onSelectWallet,
}: {
  assets: AssetComputation[];
  wallets: { walletId: string; name: string }[];
  referenceCurrency: string;
  selectedWalletId: string | null;
  onSelectWallet: (walletId: string | null) => void;
}) {
  const [typeFilter, setTypeFilter] = useState("");

  const filtered = assets
    .filter(
      (asset) =>
        (selectedWalletId === null ||
          asset.walletIds.includes(selectedWalletId)) &&
        (typeFilter === "" || asset.type === typeFilter),
    )
    // Best-performing assets first.
    .slice()
    .sort((a, b) => b.gainPct - a.gainPct);

  const filterSelectClass =
    "rounded-lg border border-black/[.12] bg-white px-2 py-1 text-xs text-zinc-600 dark:border-white/[.16] dark:bg-black dark:text-zinc-300";

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Par asset
        </h2>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filtrer par wallet"
            value={selectedWalletId ?? ""}
            onChange={(event) =>
              onSelectWallet(event.target.value || null)
            }
            className={filterSelectClass}
          >
            <option value="">Tous les wallets</option>
            {wallets.map((wallet) => (
              <option key={wallet.walletId} value={wallet.walletId}>
                {wallet.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrer par type"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className={filterSelectClass}
          >
            <option value="">Tous les types</option>
            {ASSET_TYPES.map((type) => (
              <option key={type} value={type}>
                {ASSET_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/[.15] bg-white p-6 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Aucun asset pour ce filtre.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((asset) => (
            <AssetRow
              key={asset.assetId}
              asset={asset}
              referenceCurrency={referenceCurrency}
            />
          ))}
        </div>
      )}
    </section>
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
        {portfolio.cashBalance !== 0 ? (
          <>
            <div>
              <p className="text-base font-medium text-zinc-600 tabular-nums dark:text-zinc-300">
                {formatCurrency(portfolio.cashBalance, currency)}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Espèces disponibles
              </p>
            </div>
            <div>
              <p className="text-base font-semibold text-black tabular-nums dark:text-zinc-50">
                {formatCurrency(portfolio.totalValue, currency)}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Patrimoine total (titres + espèces)
              </p>
            </div>
          </>
        ) : null}
        {portfolio.annualizedReturn !== null ? (
          <div>
            <p
              className={`text-base font-semibold tabular-nums ${
                portfolio.annualizedReturn >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatPercent(portfolio.annualizedReturn)}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              TRI annualisé
            </p>
          </div>
        ) : null}
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

function AlertsBanner({
  alerts,
  onChange,
}: {
  alerts: TriggeredAlert[];
  onChange: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function dismiss(id: string) {
    startTransition(async () => {
      await dismissAlertAction(id);
      onChange();
    });
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/60">
      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
        {alerts.length} alerte{alerts.length === 1 ? "" : "s"} de prix
        déclenchée{alerts.length === 1 ? "" : "s"}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-700 dark:text-amber-300"
          >
            <span>
              <span className="font-medium">{alert.assetName}</span>{" "}
              <span className="font-mono text-xs">{alert.assetSymbol}</span> —{" "}
              {ALERT_DIRECTION_LABELS[alert.direction].toLowerCase()}{" "}
              {formatCurrency(alert.threshold, alert.currency)}
              {alert.currentPrice !== null ? (
                <>
                  {" "}
                  (cours :{" "}
                  {formatCurrency(alert.currentPrice, alert.currency)})
                </>
              ) : null}
              {alert.note ? ` · ${alert.note}` : ""}
            </span>
            <button
              type="button"
              onClick={() => dismiss(alert.id)}
              disabled={pending}
              className="rounded-md border border-amber-300 px-2 py-0.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900"
            >
              Effacer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IncomeSummary({ income }: { income: Record<string, number> }) {
  const entries = Object.entries(income);
  return (
    <div className="rounded-2xl border border-black/[.08] bg-white p-6 dark:border-white/[.12] dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
          Revenus perçus
        </p>
        <Link
          href="/revenus"
          className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Gérer les revenus →
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-x-10 gap-y-4">
        {entries.map(([currency, total]) => (
          <div key={currency}>
            <p className="text-2xl font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
              {formatCurrency(total, currency)}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Dividendes, coupons & intérêts ({currency})
            </p>
          </div>
        ))}
      </div>
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
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-zinc-400">{expanded ? "▾" : "▸"}</span>
          <div className="min-w-0">
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
              {asset.avgBuyPrice > 0
                ? ` · PRU ${formatCurrency(asset.avgBuyPrice, asset.quoteCurrency)}`
                : ""}
            </p>
          </div>
        </div>

        {/* Current market price of the asset, in EUR and USD. */}
        <div className="text-right sm:text-left">
          <p className="font-semibold text-black tabular-nums dark:text-zinc-50">
            {asset.currentPriceEur !== null
              ? formatCurrency(asset.currentPriceEur, "EUR")
              : "—"}
          </p>
          <p className="text-xs tabular-nums text-zinc-400">
            {asset.currentPriceUsd !== null
              ? formatCurrency(asset.currentPriceUsd, "USD")
              : "—"}
            {asset.dailyChangePct !== null ? (
              <span
                className={`ml-2 font-medium ${
                  asset.dailyChangePct >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatPercent(asset.dailyChangePct)} auj.
              </span>
            ) : null}
          </p>
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
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
              Cours
            </p>
            <AssetPriceChart
              assetId={asset.assetId}
              breakEven={asset.avgBuyPrice}
              breakEvenCurrency={asset.quoteCurrency}
            />
          </div>
          <div className="overflow-x-auto">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
              Achats
            </p>
            <table className="w-full min-w-[38rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Wallet</th>
                  <th className="py-2 text-right font-medium">Quantité</th>
                  <th className="py-2 text-right font-medium">
                    Prix d&apos;achat
                  </th>
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
                      {formatCurrency(lot.unitPrice, asset.quoteCurrency)}
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

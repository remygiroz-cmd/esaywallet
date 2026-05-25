// Pure portfolio computation engine — gains/losses at four levels:
// lot, asset, wallet and global. No DB, no network: it takes plain data
// and returns plain data, which keeps it easy to test.
//
// Accounting model:
//  - A "position" is one (wallet, asset) pair. Its transactions are
//    processed chronologically using the weighted-average cost method
//    (PMP — prix moyen pondéré), the French standard.
//  - A SELL realises a gain/loss against the running average cost and
//    draws down the open quantity and cost basis.
//  - "Unrealised" figures cover the still-open position; "realised"
//    figures come from sells.
//
// Currency model:
//  - lot & wallet figures are expressed in the wallet's own currency;
//  - asset & global figures roll up into the reference currency (EUR).
// A position whose live price is unavailable is treated as flat (current
// value = open cost) in the aggregates, and flagged via `hasMissingPrice`.

import { buildFxRateMap, convertCurrency } from "@/lib/currency";
import { DEFAULT_CURRENCY, taxRateForWalletAt } from "@/lib/constants";

export type PortfolioInput = {
  wallets: {
    id: string;
    name: string;
    type: string;
    currency: string;
    taxRate?: number | null;
    openedAt?: string | null;
  }[];
  assets: {
    id: string;
    name: string;
    symbol: string;
    type: string;
    quoteCurrency: string;
  }[];
  transactions: {
    id: string;
    walletId: string;
    assetId: string;
    type: string; // "BUY" | "SELL"
    executedAt: string;
    unitPrice: number;
    quantity: number;
    // For a BUY: amount invested. For a SELL: amount received (proceeds).
    amountInvested: number;
    fees: number;
    // A SELL that is not a taxable disposal (crypto swap, transfer…).
    taxExempt?: boolean;
  }[];
  prices: {
    assetId: string;
    price: number;
    currency: string;
    change24h: number | null;
    fetchedAt: string;
  }[];
  fxRates: { quote: string; rate: number }[];
  // Uninvested cash balance per wallet, in the wallet's own currency.
  cashByWallet?: Record<string, number>;
  // Net contributions per wallet (deposits − withdrawals + manual liquidity),
  // in the wallet's own currency. Used as the cost basis for the wallet
  // "versements" view of gains/losses.
  depositsByWallet?: Record<string, number>;
};

// One BUY transaction, valued at the current price as if still fully held.
export type LotComputation = {
  transactionId: string;
  assetId: string;
  assetName: string;
  assetSymbol: string;
  walletId: string;
  walletName: string;
  walletCurrency: string;
  executedAt: string;
  quantity: number;
  unitPrice: number;
  costBasis: number; // wallet currency
  currentPrice: number | null;
  currentPriceCurrency: string | null;
  currentValue: number | null; // wallet currency
  gain: number | null; // wallet currency
  gainPct: number | null;
  priceFetchedAt: string | null;
};

// One SELL transaction, realised against the weighted-average cost.
export type SaleComputation = {
  transactionId: string;
  assetId: string;
  assetName: string;
  assetSymbol: string;
  walletId: string;
  walletName: string;
  walletCurrency: string;
  executedAt: string;
  quantity: number;
  unitPrice: number;
  proceeds: number; // wallet currency, net of fees
  costOfSold: number; // wallet currency, PMP-based
  realizedGain: number; // wallet currency
  realizedGainPct: number;
  // True when this sale is not a taxable disposal (crypto swap, transfer…).
  taxExempt: boolean;
};

export type AssetComputation = {
  assetId: string;
  name: string;
  symbol: string;
  type: string;
  quoteCurrency: string;
  totalQuantity: number; // open quantity still held
  avgCost: number; // reference currency, per unit (PMP)
  avgCostEur: number | null; // per unit, converted to EUR at the current FX
  avgCostUsd: number | null; // per unit, converted to USD at the current FX
  totalCost: number; // reference currency, open position
  currentValue: number; // reference currency
  gain: number; // reference currency, unrealised
  gainPct: number;
  realizedGain: number; // reference currency
  currentPrice: number | null;
  currentPriceCurrency: string | null;
  currentPriceEur: number | null;
  currentPriceUsd: number | null;
  dailyChangePct: number | null; // ratio, e.g. 0.025 = +2.5% over 24h
  hasMissingPrice: boolean;
  hasSales: boolean;
  walletIds: string[]; // wallets where this asset is still held
  lots: LotComputation[];
  sales: SaleComputation[];
};

// A single asset's open position inside one wallet (wallet currency).
export type WalletAssetLine = {
  assetId: string;
  name: string;
  symbol: string;
  type: string;
  quantity: number;
  currentValue: number;
  gain: number;
  gainPct: number;
  hasMissingPrice: boolean;
};

export type WalletComputation = {
  walletId: string;
  name: string;
  type: string;
  currency: string;
  totalCost: number; // wallet currency, open position (PMP cost basis)
  currentValue: number; // wallet currency, holdings only
  currentValueReference: number; // reference currency, holdings only
  cashBalance: number; // wallet currency, uninvested cash
  totalValue: number; // wallet currency, holdings + cash
  totalDeposits: number; // wallet currency, net contributions (versements)
  gain: number; // wallet currency, unrealised against PMP cost basis
  gainPct: number;
  // Plus/moins-value globale: totalValue compared to net contributions.
  globalGain: number; // wallet currency
  globalGainPct: number;
  realizedGain: number; // wallet currency
  taxRate: number; // ratio applied to realised gains
  estimatedTax: number; // wallet currency, indicative
  hasMissingPrice: boolean;
  assets: WalletAssetLine[];
  lots: LotComputation[];
};

export type PortfolioSnapshotPoint = {
  date: string;
  totalValue: number;
  totalInvested: number;
};

export type PortfolioComputation = {
  referenceCurrency: string;
  totalCost: number;
  currentValue: number; // holdings only
  cashBalance: number; // uninvested cash across all wallets
  totalValue: number; // holdings + cash
  gain: number; // unrealised
  gainPct: number;
  realizedGain: number;
  estimatedTax: number;
  // Money-weighted annualised return (XIRR), or null when undefined.
  annualizedReturn: number | null;
  hasMissingPrice: boolean;
  wallets: WalletComputation[];
  assets: AssetComputation[];
  generatedAt: string;
};

// Money-weighted annualised return from dated cash flows (XIRR), solved by
// bisection. Returns null when the cash flows don't bracket a solution.
function xirr(flows: { t: number; amount: number }[]): number | null {
  if (flows.length < 2) return null;
  const t0 = Math.min(...flows.map((flow) => flow.t));
  const YEAR_MS = 365.25 * 24 * 3600 * 1000;
  const npv = (rate: number): number =>
    flows.reduce(
      (sum, flow) =>
        sum + flow.amount / (1 + rate) ** ((flow.t - t0) / YEAR_MS),
      0,
    );

  let low = -0.95;
  let high = 50;
  let npvLow = npv(low);
  const npvHigh = npv(high);
  if (!Number.isFinite(npvLow) || !Number.isFinite(npvHigh)) return null;
  if (npvLow === 0) return low;
  if (npvHigh === 0) return high;
  if (npvLow * npvHigh > 0) return null;

  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid);
    if (Math.abs(npvMid) < 1e-6 || high - low < 1e-10) return mid;
    if (npvLow * npvMid < 0) {
      high = mid;
    } else {
      low = mid;
      npvLow = npvMid;
    }
  }
  return (low + high) / 2;
}

type PositionComputation = {
  walletId: string;
  assetId: string;
  assetName: string;
  assetSymbol: string;
  assetType: string;
  walletCurrency: string;
  openQuantity: number;
  openCostBasis: number; // wallet currency
  realizedGain: number; // wallet currency
  currentValue: number | null; // wallet currency
  unrealizedGain: number | null; // wallet currency
  lots: LotComputation[];
  sales: SaleComputation[];
};

function ratio(gain: number, cost: number): number {
  return cost > 0 ? gain / cost : 0;
}

export function computePortfolio(
  input: PortfolioInput,
  referenceCurrency: string = DEFAULT_CURRENCY,
): PortfolioComputation {
  const fx = buildFxRateMap(input.fxRates);
  const walletById = new Map(input.wallets.map((w) => [w.id, w]));
  const assetById = new Map(input.assets.map((a) => [a.id, a]));
  const priceByAsset = new Map(input.prices.map((p) => [p.assetId, p]));

  const toReference = (amount: number, from: string): number =>
    convertCurrency(amount, from, referenceCurrency, fx) ?? amount;

  // Group transactions per (wallet, asset) position.
  const groups = new Map<string, PortfolioInput["transactions"]>();
  for (const tx of input.transactions) {
    if (!walletById.has(tx.walletId) || !assetById.has(tx.assetId)) continue;
    const key = `${tx.walletId}::${tx.assetId}`;
    const list = groups.get(key);
    if (list) list.push(tx);
    else groups.set(key, [tx]);
  }

  const positions: PositionComputation[] = [];
  for (const txs of groups.values()) {
    positions.push(
      computePosition(txs, walletById, assetById, priceByAsset, fx),
    );
  }

  const wallets = aggregateWallets(
    input.wallets,
    positions,
    toReference,
    input.cashByWallet ?? {},
    input.depositsByWallet ?? {},
  );
  const assets = aggregateAssets(
    input.assets,
    positions,
    priceByAsset,
    toReference,
    fx,
    referenceCurrency,
  );

  let totalCost = 0;
  let currentValue = 0;
  let realizedGain = 0;
  let hasMissingPrice = false;
  for (const position of positions) {
    const costRef = toReference(position.openCostBasis, position.walletCurrency);
    totalCost += costRef;
    realizedGain += toReference(
      position.realizedGain,
      position.walletCurrency,
    );
    if (position.currentValue === null) {
      hasMissingPrice = true;
      currentValue += costRef;
    } else {
      currentValue += toReference(
        position.currentValue,
        position.walletCurrency,
      );
    }
  }
  const gain = currentValue - totalCost;

  let estimatedTax = 0;
  let cashBalance = 0;
  for (const wallet of wallets) {
    estimatedTax += toReference(wallet.estimatedTax, wallet.currency);
    cashBalance += toReference(wallet.cashBalance, wallet.currency);
  }

  // Money-weighted return: every buy/sell is a dated cash flow, and the
  // current portfolio value is a final inflow as of now.
  const cashFlows: { t: number; amount: number }[] = [];
  for (const tx of input.transactions) {
    const wallet = walletById.get(tx.walletId);
    if (!wallet) continue;
    const t = new Date(tx.executedAt).getTime();
    if (Number.isNaN(t)) continue;
    if (tx.type === "SELL") {
      cashFlows.push({
        t,
        amount: toReference(tx.amountInvested - tx.fees, wallet.currency),
      });
    } else {
      cashFlows.push({
        t,
        amount: -toReference(tx.amountInvested + tx.fees, wallet.currency),
      });
    }
  }
  cashFlows.push({ t: Date.now(), amount: currentValue });

  return {
    referenceCurrency,
    totalCost,
    currentValue,
    cashBalance,
    totalValue: currentValue + cashBalance,
    annualizedReturn: xirr(cashFlows),
    gain,
    gainPct: ratio(gain, totalCost),
    realizedGain,
    estimatedTax,
    hasMissingPrice,
    wallets,
    assets,
    generatedAt: new Date().toISOString(),
  };
}

function computePosition(
  txs: PortfolioInput["transactions"],
  walletById: Map<string, PortfolioInput["wallets"][number]>,
  assetById: Map<string, PortfolioInput["assets"][number]>,
  priceByAsset: Map<string, PortfolioInput["prices"][number]>,
  fx: ReturnType<typeof buildFxRateMap>,
): PositionComputation {
  const wallet = walletById.get(txs[0].walletId)!;
  const asset = assetById.get(txs[0].assetId)!;
  const price = priceByAsset.get(asset.id) ?? null;

  const ordered = [...txs].sort((a, b) =>
    a.executedAt < b.executedAt ? -1 : a.executedAt > b.executedAt ? 1 : 0,
  );

  let quantity = 0;
  let costBasis = 0;
  let realizedGain = 0;
  const lots: LotComputation[] = [];
  const sales: SaleComputation[] = [];

  // Converts a value priced in the asset/price currency to wallet currency.
  const priceToWallet = (valueInPriceCurrency: number): number | null =>
    price
      ? convertCurrency(valueInPriceCurrency, price.currency, wallet.currency, fx)
      : null;

  for (const tx of ordered) {
    if (tx.type === "SELL") {
      const pmp = quantity > 0 ? costBasis / quantity : 0;
      const soldQuantity = Math.min(tx.quantity, quantity);
      const costOfSold = pmp * soldQuantity;
      const proceeds = tx.amountInvested - tx.fees;
      const saleGain = proceeds - costOfSold;

      realizedGain += saleGain;
      quantity = Math.max(0, quantity - tx.quantity);
      costBasis = Math.max(0, costBasis - costOfSold);

      sales.push({
        transactionId: tx.id,
        assetId: asset.id,
        assetName: asset.name,
        assetSymbol: asset.symbol,
        walletId: wallet.id,
        walletName: wallet.name,
        walletCurrency: wallet.currency,
        executedAt: tx.executedAt,
        quantity: tx.quantity,
        unitPrice: tx.unitPrice,
        proceeds,
        costOfSold,
        realizedGain: saleGain,
        realizedGainPct: ratio(saleGain, costOfSold),
        taxExempt: tx.taxExempt ?? false,
      });
      continue;
    }

    // BUY
    const lotCost = tx.amountInvested + tx.fees;
    quantity += tx.quantity;
    costBasis += lotCost;

    const lotValueInPriceCurrency = price ? tx.quantity * price.price : null;
    const lotCurrentValue =
      lotValueInPriceCurrency !== null
        ? priceToWallet(lotValueInPriceCurrency)
        : null;
    const lotGain =
      lotCurrentValue !== null ? lotCurrentValue - lotCost : null;

    lots.push({
      transactionId: tx.id,
      assetId: asset.id,
      assetName: asset.name,
      assetSymbol: asset.symbol,
      walletId: wallet.id,
      walletName: wallet.name,
      walletCurrency: wallet.currency,
      executedAt: tx.executedAt,
      quantity: tx.quantity,
      unitPrice: tx.unitPrice,
      costBasis: lotCost,
      currentPrice: price?.price ?? null,
      currentPriceCurrency: price?.currency ?? null,
      currentValue: lotCurrentValue,
      gain: lotGain,
      gainPct: lotGain !== null ? ratio(lotGain, lotCost) : null,
      priceFetchedAt: price?.fetchedAt ?? null,
    });
  }

  const openValueInPriceCurrency = price ? quantity * price.price : null;
  const currentValue =
    openValueInPriceCurrency !== null
      ? priceToWallet(openValueInPriceCurrency)
      : null;

  return {
    walletId: wallet.id,
    assetId: asset.id,
    assetName: asset.name,
    assetSymbol: asset.symbol,
    assetType: asset.type,
    walletCurrency: wallet.currency,
    openQuantity: quantity,
    openCostBasis: costBasis,
    realizedGain,
    currentValue,
    unrealizedGain:
      currentValue !== null ? currentValue - costBasis : null,
    lots,
    sales,
  };
}

function aggregateWallets(
  wallets: PortfolioInput["wallets"],
  positions: PositionComputation[],
  toReference: (amount: number, from: string) => number,
  cashByWallet: Record<string, number>,
  depositsByWallet: Record<string, number>,
): WalletComputation[] {
  return wallets.map((wallet) => {
    const walletPositions = positions.filter(
      (position) => position.walletId === wallet.id,
    );

    let totalCost = 0;
    let currentValue = 0;
    let realizedGain = 0;
    let hasMissingPrice = false;
    const lots: LotComputation[] = [];
    const assets: WalletAssetLine[] = [];

    for (const position of walletPositions) {
      totalCost += position.openCostBasis;
      realizedGain += position.realizedGain;
      lots.push(...position.lots);

      const positionValue =
        position.currentValue === null
          ? position.openCostBasis
          : position.currentValue;
      if (position.currentValue === null) hasMissingPrice = true;
      currentValue += positionValue;

      // One line per asset still held in this wallet.
      if (position.openQuantity > 0) {
        const positionGain = positionValue - position.openCostBasis;
        assets.push({
          assetId: position.assetId,
          name: position.assetName,
          symbol: position.assetSymbol,
          type: position.assetType,
          quantity: position.openQuantity,
          currentValue: positionValue,
          gain: positionGain,
          gainPct: ratio(positionGain, position.openCostBasis),
          hasMissingPrice: position.currentValue === null,
        });
      }
    }

    // Best-performing assets first.
    assets.sort((a, b) => b.gainPct - a.gainPct);

    const gain = currentValue - totalCost;
    const cashBalance = cashByWallet[wallet.id] ?? 0;
    const totalDeposits = depositsByWallet[wallet.id] ?? 0;
    const totalValue = currentValue + cashBalance;
    const globalGain = totalValue - totalDeposits;
    const globalGainPct = ratio(globalGain, totalDeposits);

    // Each sale is taxed at the rate applying on its own date — this matters
    // for a PEA, which becomes income-tax exempt after 5 years.
    // PEA sales are internal moves: they are taxed on withdrawal, not here.
    // Crypto-to-crypto swaps and transfers are flagged tax-exempt.
    const nowIso = new Date().toISOString();
    const taxRate = taxRateForWalletAt(wallet, nowIso);
    let estimatedTax = 0;
    if (wallet.type !== "PEA") {
      for (const position of walletPositions) {
        for (const sale of position.sales) {
          if (sale.taxExempt) continue;
          estimatedTax +=
            Math.max(0, sale.realizedGain) *
            taxRateForWalletAt(wallet, sale.executedAt);
        }
      }
    }

    return {
      walletId: wallet.id,
      name: wallet.name,
      type: wallet.type,
      currency: wallet.currency,
      totalCost,
      currentValue,
      currentValueReference: toReference(currentValue, wallet.currency),
      cashBalance,
      totalValue,
      totalDeposits,
      gain,
      gainPct: ratio(gain, totalCost),
      globalGain,
      globalGainPct,
      realizedGain,
      taxRate,
      estimatedTax,
      hasMissingPrice,
      assets,
      lots,
    };
  });
}

function aggregateAssets(
  assets: PortfolioInput["assets"],
  positions: PositionComputation[],
  priceByAsset: Map<string, PortfolioInput["prices"][number]>,
  toReference: (amount: number, from: string) => number,
  fx: ReturnType<typeof buildFxRateMap>,
  referenceCurrency: string,
): AssetComputation[] {
  return assets
    .map((asset) => {
      const assetPositions = positions.filter(
        (position) => position.assetId === asset.id,
      );
      if (assetPositions.length === 0) return null;

      let totalQuantity = 0;
      let totalCost = 0;
      let currentValue = 0;
      let realizedGain = 0;
      let hasMissingPrice = false;
      let hasSales = false;
      const lots: LotComputation[] = [];
      const sales: SaleComputation[] = [];

      for (const position of assetPositions) {
        const costRef = toReference(
          position.openCostBasis,
          position.walletCurrency,
        );
        totalQuantity += position.openQuantity;
        totalCost += costRef;
        realizedGain += toReference(
          position.realizedGain,
          position.walletCurrency,
        );
        lots.push(...position.lots);
        sales.push(...position.sales);
        if (position.sales.length > 0) hasSales = true;
        if (position.currentValue === null) {
          hasMissingPrice = true;
          currentValue += costRef;
        } else {
          currentValue += toReference(
            position.currentValue,
            position.walletCurrency,
          );
        }
      }

      const gain = currentValue - totalCost;
      const price = priceByAsset.get(asset.id) ?? null;
      const walletIds = [
        ...new Set(
          assetPositions
            .filter((position) => position.openQuantity > 0)
            .map((position) => position.walletId),
        ),
      ];

      const avgCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;

      return {
        assetId: asset.id,
        name: asset.name,
        symbol: asset.symbol,
        type: asset.type,
        quoteCurrency: asset.quoteCurrency,
        totalQuantity,
        avgCost,
        avgCostEur:
          avgCost > 0
            ? convertCurrency(avgCost, referenceCurrency, "EUR", fx)
            : null,
        avgCostUsd:
          avgCost > 0
            ? convertCurrency(avgCost, referenceCurrency, "USD", fx)
            : null,
        totalCost,
        currentValue,
        gain,
        gainPct: ratio(gain, totalCost),
        realizedGain,
        currentPrice: price?.price ?? null,
        currentPriceCurrency: price?.currency ?? null,
        currentPriceEur: price
          ? convertCurrency(price.price, price.currency, "EUR", fx)
          : null,
        currentPriceUsd: price
          ? convertCurrency(price.price, price.currency, "USD", fx)
          : null,
        dailyChangePct:
          price && price.change24h !== null ? price.change24h / 100 : null,
        hasMissingPrice,
        hasSales,
        walletIds,
        lots: lots.sort((a, b) =>
          a.executedAt < b.executedAt ? 1 : -1,
        ),
        sales: sales.sort((a, b) =>
          a.executedAt < b.executedAt ? 1 : -1,
        ),
      };
    })
    .filter((asset): asset is AssetComputation => asset !== null)
    // Keep assets that are still held or that have realised history.
    .filter(
      (asset) =>
        asset.totalQuantity > 0 ||
        asset.sales.length > 0 ||
        asset.lots.length > 0,
    );
}

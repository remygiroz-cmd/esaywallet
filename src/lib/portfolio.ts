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
import { DEFAULT_CURRENCY, taxRateForWalletType } from "@/lib/constants";

export type PortfolioInput = {
  wallets: { id: string; name: string; type: string; currency: string }[];
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
  }[];
  prices: {
    assetId: string;
    price: number;
    currency: string;
    change24h: number | null;
    fetchedAt: string;
  }[];
  fxRates: { quote: string; rate: number }[];
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
};

export type AssetComputation = {
  assetId: string;
  name: string;
  symbol: string;
  type: string;
  quoteCurrency: string;
  totalQuantity: number; // open quantity still held
  avgCost: number; // reference currency, per unit (PMP)
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
  totalCost: number; // wallet currency, open position
  currentValue: number; // wallet currency
  gain: number; // wallet currency, unrealised
  gainPct: number;
  realizedGain: number; // wallet currency
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
  currentValue: number;
  gain: number; // unrealised
  gainPct: number;
  realizedGain: number;
  estimatedTax: number;
  hasMissingPrice: boolean;
  wallets: WalletComputation[];
  assets: AssetComputation[];
  generatedAt: string;
};

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

  const wallets = aggregateWallets(input.wallets, positions);
  const assets = aggregateAssets(
    input.assets,
    positions,
    priceByAsset,
    toReference,
    fx,
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
  for (const wallet of wallets) {
    estimatedTax += toReference(wallet.estimatedTax, wallet.currency);
  }

  return {
    referenceCurrency,
    totalCost,
    currentValue,
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

    assets.sort((a, b) => b.currentValue - a.currentValue);

    const gain = currentValue - totalCost;
    return {
      walletId: wallet.id,
      name: wallet.name,
      type: wallet.type,
      currency: wallet.currency,
      totalCost,
      currentValue,
      gain,
      gainPct: ratio(gain, totalCost),
      realizedGain,
      estimatedTax:
        Math.max(0, realizedGain) * taxRateForWalletType(wallet.type),
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

      return {
        assetId: asset.id,
        name: asset.name,
        symbol: asset.symbol,
        type: asset.type,
        quoteCurrency: asset.quoteCurrency,
        totalQuantity,
        avgCost: totalQuantity > 0 ? totalCost / totalQuantity : 0,
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

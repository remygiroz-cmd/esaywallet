// Pure portfolio computation engine — gains/losses at four levels:
// lot, asset, wallet and global. No DB, no network: it takes plain data
// and returns plain data, which keeps it easy to test.
//
// Currency model:
//  - lot & wallet figures are expressed in the wallet's own currency;
//  - asset & global figures are expressed in the reference currency (EUR),
//    since they aggregate lots that may live in different currencies.
// A lot whose live price is unavailable is treated as flat (current value
// = cost) in the aggregates, and flagged via `hasMissingPrice`.

import { buildFxRateMap, convertCurrency } from "@/lib/currency";
import { DEFAULT_CURRENCY } from "@/lib/constants";

export type PortfolioInput = {
  wallets: {
    id: string;
    name: string;
    type: string;
    currency: string;
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
    executedAt: string;
    unitPrice: number;
    quantity: number;
    amountInvested: number;
    fees: number;
  }[];
  prices: {
    assetId: string;
    price: number;
    currency: string;
    fetchedAt: string;
  }[];
  fxRates: { quote: string; rate: number }[];
};

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

export type AssetComputation = {
  assetId: string;
  name: string;
  symbol: string;
  type: string;
  quoteCurrency: string;
  totalQuantity: number;
  avgCost: number; // reference currency, per unit
  totalCost: number; // reference currency
  currentValue: number; // reference currency
  gain: number; // reference currency
  gainPct: number;
  currentPrice: number | null;
  currentPriceCurrency: string | null;
  hasMissingPrice: boolean;
  lots: LotComputation[];
};

export type WalletComputation = {
  walletId: string;
  name: string;
  type: string;
  currency: string;
  totalCost: number; // wallet currency
  currentValue: number; // wallet currency
  gain: number; // wallet currency
  gainPct: number;
  hasMissingPrice: boolean;
  lots: LotComputation[];
};

export type PortfolioComputation = {
  referenceCurrency: string;
  totalCost: number;
  currentValue: number;
  gain: number;
  gainPct: number;
  hasMissingPrice: boolean;
  wallets: WalletComputation[];
  assets: AssetComputation[];
  generatedAt: string;
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

  // Converts an amount to the reference currency, falling back to the raw
  // amount if a rate is genuinely missing (vanishingly rare in practice).
  const toReference = (amount: number, from: string): number =>
    convertCurrency(amount, from, referenceCurrency, fx) ?? amount;

  const lots: LotComputation[] = [];

  for (const tx of input.transactions) {
    const wallet = walletById.get(tx.walletId);
    const asset = assetById.get(tx.assetId);
    if (!wallet || !asset) continue;

    const costBasis = tx.amountInvested + tx.fees;
    const price = priceByAsset.get(asset.id) ?? null;

    let currentValue: number | null = null;
    let gain: number | null = null;
    let gainPct: number | null = null;

    if (price) {
      const valueInPriceCurrency = tx.quantity * price.price;
      currentValue = convertCurrency(
        valueInPriceCurrency,
        price.currency,
        wallet.currency,
        fx,
      );
      if (currentValue !== null) {
        gain = currentValue - costBasis;
        gainPct = ratio(gain, costBasis);
      }
    }

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
      costBasis,
      currentPrice: price?.price ?? null,
      currentPriceCurrency: price?.currency ?? null,
      currentValue,
      gain,
      gainPct,
      priceFetchedAt: price?.fetchedAt ?? null,
    });
  }

  const wallets = aggregateWallets(input.wallets, lots);
  const assets = aggregateAssets(input.assets, lots, priceByAsset, toReference);

  let totalCost = 0;
  let currentValue = 0;
  let hasMissingPrice = false;
  for (const lot of lots) {
    const wallet = walletById.get(lot.walletId);
    if (!wallet) continue;
    const costRef = toReference(lot.costBasis, wallet.currency);
    totalCost += costRef;
    if (lot.currentValue === null) {
      hasMissingPrice = true;
      currentValue += costRef; // treat as flat until the price loads
    } else {
      currentValue += toReference(lot.currentValue, wallet.currency);
    }
  }
  const gain = currentValue - totalCost;

  return {
    referenceCurrency,
    totalCost,
    currentValue,
    gain,
    gainPct: ratio(gain, totalCost),
    hasMissingPrice,
    wallets,
    assets,
    generatedAt: new Date().toISOString(),
  };
}

function aggregateWallets(
  wallets: PortfolioInput["wallets"],
  lots: LotComputation[],
): WalletComputation[] {
  return wallets.map((wallet) => {
    const walletLots = lots.filter((lot) => lot.walletId === wallet.id);
    let totalCost = 0;
    let currentValue = 0;
    let hasMissingPrice = false;

    for (const lot of walletLots) {
      totalCost += lot.costBasis;
      if (lot.currentValue === null) {
        hasMissingPrice = true;
        currentValue += lot.costBasis;
      } else {
        currentValue += lot.currentValue;
      }
    }

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
      hasMissingPrice,
      lots: walletLots,
    };
  });
}

function aggregateAssets(
  assets: PortfolioInput["assets"],
  lots: LotComputation[],
  priceByAsset: Map<string, PortfolioInput["prices"][number]>,
  toReference: (amount: number, from: string) => number,
): AssetComputation[] {
  const walletCurrencyByLot = new Map(
    lots.map((lot) => [lot.transactionId, lot.walletCurrency]),
  );

  return assets
    .map((asset) => {
      const assetLots = lots.filter((lot) => lot.assetId === asset.id);
      let totalQuantity = 0;
      let totalCost = 0;
      let currentValue = 0;
      let hasMissingPrice = false;

      for (const lot of assetLots) {
        const currency = walletCurrencyByLot.get(lot.transactionId) ?? "EUR";
        const costRef = toReference(lot.costBasis, currency);
        totalQuantity += lot.quantity;
        totalCost += costRef;
        if (lot.currentValue === null) {
          hasMissingPrice = true;
          currentValue += costRef;
        } else {
          currentValue += toReference(lot.currentValue, currency);
        }
      }

      const gain = currentValue - totalCost;
      const price = priceByAsset.get(asset.id) ?? null;

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
        currentPrice: price?.price ?? null,
        currentPriceCurrency: price?.currency ?? null,
        hasMissingPrice,
        lots: assetLots,
      };
    })
    .filter((asset) => asset.lots.length > 0);
}

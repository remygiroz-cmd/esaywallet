// Allowed values for the String-typed "type" columns in the Prisma schema.
// SQLite has no native enums, so these are the single source of truth.

export const WALLET_TYPES = ["CTO", "PEA", "CRYPTO", "LIVRET", "OTHER"] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

export const ASSET_TYPES = ["STOCK", "ETF", "CRYPTO"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const TRANSACTION_TYPES = ["BUY", "SELL"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: SupportedCurrency = "EUR";

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  CTO: "Compte-titres ordinaire",
  PEA: "Plan d'épargne en actions",
  CRYPTO: "Portefeuille crypto",
  LIVRET: "Livret / épargne",
  OTHER: "Autre",
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  STOCK: "Action",
  ETF: "ETF",
  CRYPTO: "Cryptomonnaie",
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  BUY: "Achat",
  SELL: "Vente",
};

// Indicative French tax rates applied to net realised gains, by wallet type:
//  - CTO / crypto / autre : flat tax (PFU) 30 %
//  - PEA : income-tax exempt, only social contributions (17,2 %)
//  - Livret : tax-free savings
// These are estimates only — real taxation depends on holding period and
// the investor's situation.
export const TAX_RATE_BY_WALLET_TYPE: Record<WalletType, number> = {
  CTO: 0.3,
  PEA: 0.172,
  CRYPTO: 0.3,
  LIVRET: 0,
  OTHER: 0.3,
};

export function taxRateForWalletType(type: string): number {
  return TAX_RATE_BY_WALLET_TYPE[type as WalletType] ?? 0.3;
}

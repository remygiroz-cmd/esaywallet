// Allowed values for the String-typed "type" columns in the Prisma schema.
// SQLite has no native enums, so these are the single source of truth.

export const WALLET_TYPES = ["CTO", "PEA", "CRYPTO", "LIVRET", "OTHER"] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

export const ASSET_TYPES = ["STOCK", "ETF", "CRYPTO"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const TRANSACTION_TYPES = ["BUY", "SELL"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const DEFAULT_CURRENCY = "EUR";

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

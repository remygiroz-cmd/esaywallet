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

export const INCOME_KINDS = [
  "DIVIDEND",
  "COUPON",
  "STAKING",
  "INTEREST",
] as const;
export type IncomeKind = (typeof INCOME_KINDS)[number];

export const INCOME_KIND_LABELS: Record<IncomeKind, string> = {
  DIVIDEND: "Dividende",
  COUPON: "Coupon",
  STAKING: "Récompense de staking",
  INTEREST: "Intérêts",
};

export const CASH_MOVEMENT_KINDS = ["DEPOSIT", "WITHDRAWAL"] as const;
export type CashMovementKind = (typeof CASH_MOVEMENT_KINDS)[number];

export const CASH_MOVEMENT_KIND_LABELS: Record<CashMovementKind, string> = {
  DEPOSIT: "Dépôt",
  WITHDRAWAL: "Retrait",
};

export const ALERT_DIRECTIONS = ["ABOVE", "BELOW"] as const;
export type AlertDirection = (typeof ALERT_DIRECTIONS)[number];

export const ALERT_DIRECTION_LABELS: Record<AlertDirection, string> = {
  ABOVE: "Au-dessus de",
  BELOW: "En dessous de",
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

// A PEA becomes income-tax exempt (social contributions only) after 5 years;
// gains realised before that are taxed at the flat tax rate.
export const PEA_MATURITY_YEARS = 5;
const PEA_RATE_BEFORE_MATURITY = 0.3;
const YEAR_MS = 365.25 * 24 * 3600 * 1000;

// Tax rate applying to a gain/income realised at `dateIso`, taking into
// account a manual override and — for a PEA — its opening date.
export function taxRateForWalletAt(
  wallet: { type: string; taxRate?: number | null; openedAt?: string | null },
  dateIso: string,
): number {
  // A manual per-wallet override always wins.
  if (wallet.taxRate != null) return wallet.taxRate;

  if (wallet.type === "PEA" && wallet.openedAt) {
    const opened = new Date(wallet.openedAt).getTime();
    const date = new Date(dateIso).getTime();
    if (Number.isFinite(opened) && Number.isFinite(date)) {
      const years = (date - opened) / YEAR_MS;
      return years < PEA_MATURITY_YEARS
        ? PEA_RATE_BEFORE_MATURITY
        : taxRateForWalletType("PEA");
    }
  }

  return taxRateForWalletType(wallet.type);
}

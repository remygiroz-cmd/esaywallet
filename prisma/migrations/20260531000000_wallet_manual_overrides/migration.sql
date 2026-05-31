-- Replace the additive "manualLiquidity" column with two nullable manual
-- overrides: net contributions (versements) and cash balance (espèces). A
-- null value means "compute it from movements/transactions"; a non-null
-- value replaces the computed figure on the wallet card.

-- Reuse the existing column for the cash override.
ALTER TABLE "Wallet" RENAME COLUMN "manualLiquidity" TO "manualCash";
ALTER TABLE "Wallet" ALTER COLUMN "manualCash" DROP DEFAULT;
ALTER TABLE "Wallet" ALTER COLUMN "manualCash" DROP NOT NULL;
-- The old default (0) meant "no manual liquidity"; map it to "not set".
UPDATE "Wallet" SET "manualCash" = NULL WHERE "manualCash" = 0;

-- New override for the net contributions (versements).
ALTER TABLE "Wallet" ADD COLUMN "manualDeposits" DECIMAL(65,30);

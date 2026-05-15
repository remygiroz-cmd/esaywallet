-- Add the Profile model and re-scope every per-user data table from
-- userId to profileId. Existing rows are migrated to a per-user default
-- profile so nothing is lost.

-- 1. Profile table
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. One default profile per existing user (deterministic id so backfill
--    queries can find it).
INSERT INTO "Profile" ("id", "userId", "name", "isDefault", "createdAt", "updatedAt")
SELECT
    'profile_' || "id",
    "id",
    'Mon portefeuille',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User";

-- 3. Wallet
ALTER TABLE "Wallet" ADD COLUMN "profileId" TEXT;
UPDATE "Wallet" SET "profileId" = 'profile_' || "userId";
ALTER TABLE "Wallet" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "Wallet" DROP CONSTRAINT "Wallet_userId_fkey";
DROP INDEX "Wallet_userId_idx";
ALTER TABLE "Wallet" DROP COLUMN "userId";
CREATE INDEX "Wallet_profileId_idx" ON "Wallet"("profileId");
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Asset (also rebuild composite unique)
ALTER TABLE "Asset" ADD COLUMN "profileId" TEXT;
UPDATE "Asset" SET "profileId" = 'profile_' || "userId";
ALTER TABLE "Asset" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_userId_fkey";
DROP INDEX "Asset_userId_symbol_type_key";
DROP INDEX "Asset_userId_idx";
ALTER TABLE "Asset" DROP COLUMN "userId";
CREATE UNIQUE INDEX "Asset_profileId_symbol_type_key"
    ON "Asset"("profileId", "symbol", "type");
CREATE INDEX "Asset_profileId_idx" ON "Asset"("profileId");
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. TaxAdjustment
ALTER TABLE "TaxAdjustment" ADD COLUMN "profileId" TEXT;
UPDATE "TaxAdjustment" SET "profileId" = 'profile_' || "userId";
ALTER TABLE "TaxAdjustment" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "TaxAdjustment" DROP CONSTRAINT "TaxAdjustment_userId_fkey";
DROP INDEX "TaxAdjustment_userId_year_key";
ALTER TABLE "TaxAdjustment" DROP COLUMN "userId";
CREATE UNIQUE INDEX "TaxAdjustment_profileId_year_key"
    ON "TaxAdjustment"("profileId", "year");
ALTER TABLE "TaxAdjustment" ADD CONSTRAINT "TaxAdjustment_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. PriceAlert
ALTER TABLE "PriceAlert" ADD COLUMN "profileId" TEXT;
UPDATE "PriceAlert" SET "profileId" = 'profile_' || "userId";
ALTER TABLE "PriceAlert" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "PriceAlert" DROP CONSTRAINT "PriceAlert_userId_fkey";
DROP INDEX "PriceAlert_userId_idx";
ALTER TABLE "PriceAlert" DROP COLUMN "userId";
CREATE INDEX "PriceAlert_profileId_idx" ON "PriceAlert"("profileId");
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. RealizedGainEntry
ALTER TABLE "RealizedGainEntry" ADD COLUMN "profileId" TEXT;
UPDATE "RealizedGainEntry" SET "profileId" = 'profile_' || "userId";
ALTER TABLE "RealizedGainEntry" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "RealizedGainEntry" DROP CONSTRAINT "RealizedGainEntry_userId_fkey";
DROP INDEX "RealizedGainEntry_userId_idx";
ALTER TABLE "RealizedGainEntry" DROP COLUMN "userId";
CREATE INDEX "RealizedGainEntry_profileId_idx" ON "RealizedGainEntry"("profileId");
ALTER TABLE "RealizedGainEntry" ADD CONSTRAINT "RealizedGainEntry_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. Document
ALTER TABLE "Document" ADD COLUMN "profileId" TEXT;
UPDATE "Document" SET "profileId" = 'profile_' || "userId";
ALTER TABLE "Document" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "Document" DROP CONSTRAINT "Document_userId_fkey";
DROP INDEX "Document_userId_idx";
ALTER TABLE "Document" DROP COLUMN "userId";
CREATE INDEX "Document_profileId_idx" ON "Document"("profileId");
ALTER TABLE "Document" ADD CONSTRAINT "Document_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 9. PortfolioSnapshot
ALTER TABLE "PortfolioSnapshot" ADD COLUMN "profileId" TEXT;
UPDATE "PortfolioSnapshot" SET "profileId" = 'profile_' || "userId";
ALTER TABLE "PortfolioSnapshot" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "PortfolioSnapshot" DROP CONSTRAINT "PortfolioSnapshot_userId_fkey";
DROP INDEX "PortfolioSnapshot_userId_walletId_date_key";
DROP INDEX "PortfolioSnapshot_userId_date_idx";
ALTER TABLE "PortfolioSnapshot" DROP COLUMN "userId";
CREATE UNIQUE INDEX "PortfolioSnapshot_profileId_walletId_date_key"
    ON "PortfolioSnapshot"("profileId", "walletId", "date");
CREATE INDEX "PortfolioSnapshot_profileId_date_idx"
    ON "PortfolioSnapshot"("profileId", "date");
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Dividend" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "walletId" TEXT,
    "assetId" TEXT,
    "source" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "grossAmount" DECIMAL(65,30) NOT NULL,
    "withheldTax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "taxRate" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dividend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dividend_profileId_idx" ON "Dividend"("profileId");

-- CreateIndex
CREATE INDEX "Dividend_walletId_idx" ON "Dividend"("walletId");

-- CreateIndex
CREATE INDEX "Dividend_assetId_idx" ON "Dividend"("assetId");

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable Row-Level Security on the new table — Supabase exposes every
-- public-schema table through its PostgREST API, so without RLS the anon
-- key would grant access. The Prisma role has BYPASSRLS, so app queries
-- are unaffected; PostgREST gets a deny-by-default.
ALTER TABLE "Dividend" ENABLE ROW LEVEL SECURITY;

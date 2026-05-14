-- CreateTable
CREATE TABLE "RealizedGainEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT,
    "year" INTEGER NOT NULL,
    "securityName" TEXT NOT NULL,
    "securityCode" TEXT,
    "proceeds" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "realizedGain" DECIMAL(65,30) NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealizedGainEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RealizedGainEntry_userId_idx" ON "RealizedGainEntry"("userId");

-- CreateIndex
CREATE INDEX "RealizedGainEntry_walletId_idx" ON "RealizedGainEntry"("walletId");

-- AddForeignKey
ALTER TABLE "RealizedGainEntry" ADD CONSTRAINT "RealizedGainEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealizedGainEntry" ADD CONSTRAINT "RealizedGainEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

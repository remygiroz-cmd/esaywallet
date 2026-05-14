-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN "taxRate" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "TaxAdjustment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "carryForwardLoss" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxAdjustment_userId_year_key" ON "TaxAdjustment"("userId", "year");

-- AddForeignKey
ALTER TABLE "TaxAdjustment" ADD CONSTRAINT "TaxAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

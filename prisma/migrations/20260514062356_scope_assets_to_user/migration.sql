/*
  Warnings:

  - Added the required column `userId` to the `Asset` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "coingeckoId" TEXT,
    "yahooSymbol" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Asset" ("coingeckoId", "createdAt", "id", "name", "quoteCurrency", "symbol", "type", "updatedAt", "yahooSymbol") SELECT "coingeckoId", "createdAt", "id", "name", "quoteCurrency", "symbol", "type", "updatedAt", "yahooSymbol" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
CREATE INDEX "Asset_userId_idx" ON "Asset"("userId");
CREATE UNIQUE INDEX "Asset_userId_symbol_type_key" ON "Asset"("userId", "symbol", "type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

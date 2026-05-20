-- Enable Row-Level Security on every application table.
--
-- The database is hosted on Supabase, which exposes any table in the
-- "public" schema through its auto-generated PostgREST API. Without RLS,
-- the project's anon key would grant read/write access to all rows.
-- This app talks to Postgres only through Prisma using a role that has
-- BYPASSRLS (the Supabase pooler `postgres` role), so enabling RLS
-- without any policies denies all access via PostgREST while leaving
-- application queries unaffected.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxAdjustment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Wallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RealizedGainEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceAlert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Income" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceCache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FxRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortfolioSnapshot" ENABLE ROW LEVEL SECURITY;

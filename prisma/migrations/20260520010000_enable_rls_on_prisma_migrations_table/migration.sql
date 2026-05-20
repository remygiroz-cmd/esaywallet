-- The internal Prisma migrations bookkeeping table also lives in the
-- "public" schema and is exposed by Supabase's PostgREST API. Enable
-- RLS on it for the same reason as the application tables: deny anon
-- access while leaving Prisma's BYPASSRLS connection unaffected.

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

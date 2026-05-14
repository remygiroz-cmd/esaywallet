import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { searchAssets } from "@/lib/prices/search";

export const dynamic = "force-dynamic";

// Looks up an asset by name across CoinGecko (crypto) and Yahoo Finance
// (stocks/ETFs), so the user never has to know the external identifiers.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const results = await searchAssets(query);
  return NextResponse.json({ results });
}

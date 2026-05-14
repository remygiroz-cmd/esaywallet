import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { refreshPrices } from "@/lib/prices/service";
import { loadPortfolio } from "@/lib/portfolio-server";

export const dynamic = "force-dynamic";

// Polled by the dashboard every minute: refreshes live prices, then returns
// the freshly computed portfolio at all four levels.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const refresh = await refreshPrices(user.id);
  const portfolio = await loadPortfolio(user.id);

  return NextResponse.json({ portfolio, refresh });
}

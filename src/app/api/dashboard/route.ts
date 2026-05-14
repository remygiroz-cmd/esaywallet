import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { refreshPrices } from "@/lib/prices/service";
import { loadPortfolio } from "@/lib/portfolio-server";
import { getIncomeTotalByCurrency } from "@/lib/income";
import { recordGlobalSnapshot, getGlobalSnapshots } from "@/lib/snapshots";

export const dynamic = "force-dynamic";

// Polled by the dashboard every minute: refreshes live prices, recomputes
// the portfolio at all four levels, updates today's history snapshot and
// returns everything the dashboard needs.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const refresh = await refreshPrices(user.id);
  const portfolio = await loadPortfolio(user.id);
  const incomeByCurrency = await getIncomeTotalByCurrency(user.id);

  await recordGlobalSnapshot(
    user.id,
    portfolio.currentValue,
    portfolio.totalCost,
    portfolio.referenceCurrency,
  );
  const history = await getGlobalSnapshots(user.id);

  return NextResponse.json({
    portfolio,
    history,
    refresh,
    income: Object.fromEntries(incomeByCurrency),
  });
}

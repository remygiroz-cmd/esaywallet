import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth-server";
import { refreshPrices } from "@/lib/prices/service";
import { loadPortfolio } from "@/lib/portfolio-server";
import { getIncomeTotalByCurrency } from "@/lib/income";
import { evaluateAlerts, getTriggeredAlerts } from "@/lib/alerts";
import { recordGlobalSnapshot, getGlobalSnapshots } from "@/lib/snapshots";

export const dynamic = "force-dynamic";

// Polled by the dashboard every minute: refreshes live prices, recomputes
// the portfolio at all four levels, updates today's history snapshot and
// returns everything the dashboard needs.
export async function GET() {
  const session = await getCurrentSession();
  const profile = session?.profile;
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const refresh = await refreshPrices(profile!.id);
  const portfolio = await loadPortfolio(profile!.id);
  const incomeByCurrency = await getIncomeTotalByCurrency(profile!.id);

  // Live prices were just refreshed — check the alert thresholds against them.
  await evaluateAlerts(profile!.id);
  const alerts = await getTriggeredAlerts(profile!.id);

  await recordGlobalSnapshot(
    profile!.id,
    portfolio.currentValue,
    portfolio.totalCost,
    portfolio.referenceCurrency,
  );
  const history = await getGlobalSnapshots(profile!.id);

  return NextResponse.json({
    portfolio,
    history,
    refresh,
    income: Object.fromEntries(incomeByCurrency),
    alerts,
  });
}

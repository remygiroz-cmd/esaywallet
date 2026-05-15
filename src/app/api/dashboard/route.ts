import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth-server";
import { loadPortfolio } from "@/lib/portfolio-server";
import { getIncomeTotalByCurrency } from "@/lib/income";
import { evaluateAlerts, getTriggeredAlerts } from "@/lib/alerts";
import { recordGlobalSnapshot, getGlobalSnapshots } from "@/lib/snapshots";

export const dynamic = "force-dynamic";

// Polled by the dashboard. Returns whatever prices are already cached
// (fast — DB only) so the UI repaints instantly. The client triggers
// /api/prices/refresh on its own, in parallel, and refetches this
// endpoint once the refresh completes — keeping the live-price call
// off this hot path is what makes the dashboard feel responsive.
export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const profileId = session.profile.id;

  const [portfolio, incomeByCurrency] = await Promise.all([
    loadPortfolio(profileId),
    getIncomeTotalByCurrency(profileId),
  ]);

  // Evaluate alerts and snapshot today's value against whatever's cached.
  await evaluateAlerts(profileId);
  const [alerts] = await Promise.all([
    getTriggeredAlerts(profileId),
    recordGlobalSnapshot(
      profileId,
      portfolio.currentValue,
      portfolio.totalCost,
      portfolio.referenceCurrency,
    ),
  ]);
  const history = await getGlobalSnapshots(profileId);

  return NextResponse.json({
    portfolio,
    history,
    income: Object.fromEntries(incomeByCurrency),
    alerts,
  });
}

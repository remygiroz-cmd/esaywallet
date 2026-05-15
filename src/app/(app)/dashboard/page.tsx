import { requireProfile } from "@/lib/auth-server";
import { loadPortfolio } from "@/lib/portfolio-server";
import { getIncomeTotalByCurrency } from "@/lib/income";
import { getTriggeredAlerts } from "@/lib/alerts";
import { getGlobalSnapshots } from "@/lib/snapshots";
import { DashboardLive } from "@/components/dashboard-live";

export default async function DashboardPage() {
  const { profile } = await requireProfile();
  // Initial render uses whatever prices are already cached — instant.
  // DashboardLive then polls /api/dashboard, which refreshes live prices.
  const [portfolio, history, incomeByCurrency, alerts] = await Promise.all([
    loadPortfolio(profile.id),
    getGlobalSnapshots(profile.id),
    getIncomeTotalByCurrency(profile.id),
    getTriggeredAlerts(profile.id),
  ]);

  return (
    <DashboardLive
      initialPortfolio={portfolio}
      initialHistory={history}
      initialIncome={Object.fromEntries(incomeByCurrency)}
      initialAlerts={alerts}
    />
  );
}

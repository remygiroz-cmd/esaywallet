import { requireUser } from "@/lib/auth-server";
import { loadPortfolio } from "@/lib/portfolio-server";
import { getGlobalSnapshots } from "@/lib/snapshots";
import { DashboardLive } from "@/components/dashboard-live";

export default async function DashboardPage() {
  const user = await requireUser();
  // Initial render uses whatever prices are already cached — instant.
  // DashboardLive then polls /api/dashboard, which refreshes live prices.
  const [portfolio, history] = await Promise.all([
    loadPortfolio(user.id),
    getGlobalSnapshots(user.id),
  ]);

  return (
    <DashboardLive initialPortfolio={portfolio} initialHistory={history} />
  );
}

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth-server";
import { refreshPrices } from "@/lib/prices/service";

export const dynamic = "force-dynamic";

// Manual price refresh trigger (e.g. an "Actualiser" button). The dashboard
// endpoint refreshes prices on its own, so this is a convenience route.
export async function POST() {
  const session = await getCurrentSession();
  const profile = session?.profile;
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const result = await refreshPrices(profile!.id);
  return NextResponse.json(result);
}

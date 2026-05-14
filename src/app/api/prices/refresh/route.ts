import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { refreshPrices } from "@/lib/prices/service";

export const dynamic = "force-dynamic";

// Manual price refresh trigger (e.g. an "Actualiser" button). The dashboard
// endpoint refreshes prices on its own, so this is a convenience route.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const result = await refreshPrices(user.id);
  return NextResponse.json(result);
}

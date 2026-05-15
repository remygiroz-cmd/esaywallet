import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth-server";
import { getAsset } from "@/lib/assets";
import {
  fetchAssetHistory,
  HISTORY_RANGES,
  type HistoryRange,
} from "@/lib/prices/history";

export const dynamic = "force-dynamic";

// Historical price series for one asset, over the requested timeframe.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  const profile = session?.profile;
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await context.params;
  const asset = await getAsset(id, profile!.id);
  if (!asset) {
    return NextResponse.json({ error: "Asset introuvable" }, { status: 404 });
  }

  const requested = request.nextUrl.searchParams.get("range");
  const range: HistoryRange = HISTORY_RANGES.includes(
    requested as HistoryRange,
  )
    ? (requested as HistoryRange)
    : "1J";

  const history = await fetchAssetHistory(asset, range);
  return NextResponse.json({ history, range });
}

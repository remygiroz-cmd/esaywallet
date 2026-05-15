import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth-server";
import { runFiscalAssistant } from "@/lib/fiscal-assistant";

export const dynamic = "force-dynamic";
// The analysis (large input + adaptive thinking) can take a while.
export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await getCurrentSession();
  const profile = session?.profile;
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { taxYear?: unknown; answers?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const taxYear = Number(body.taxYear);
  if (!Number.isInteger(taxYear) || taxYear < 1990 || taxYear > 2100) {
    return NextResponse.json(
      { error: "Année fiscale invalide" },
      { status: 400 },
    );
  }
  const answers = typeof body.answers === "string" ? body.answers : "";

  const result = await runFiscalAssistant(profile!.id, taxYear, answers);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ report: result.report });
}

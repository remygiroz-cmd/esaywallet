import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCurrentSession,
  setActiveProfile,
} from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  profileId: z.string().min(1),
});

// Sets the active-profile cookie. The client triggers this on a
// dropdown change, then calls router.refresh() to re-render the layout
// and child pages against the new profile — no page reload needed.
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Profil manquant" },
      { status: 400 },
    );
  }

  // Validate ownership before pinning the cookie.
  const profile = await prisma.profile.findFirst({
    where: { id: parsed.data.profileId, userId: session.user.id },
    select: { id: true },
  });
  if (!profile) {
    return NextResponse.json(
      { error: "Profil introuvable" },
      { status: 404 },
    );
  }

  await setActiveProfile(profile.id);
  return NextResponse.json({ ok: true });
}

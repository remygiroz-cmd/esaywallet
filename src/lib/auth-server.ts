import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export const ACTIVE_PROFILE_COOKIE = "easywallet_profile";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
};

export type CurrentProfile = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type CurrentSession = {
  user: CurrentUser;
  profile: CurrentProfile;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true },
  });
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Guarantees a user has at least one profile — used as a defensive
// recovery if the auto-create on signup didn't run for some reason.
async function ensureDefaultProfile(userId: string): Promise<CurrentProfile> {
  const existing = await prisma.profile.findFirst({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, isDefault: true },
  });
  if (existing) return existing;
  return prisma.profile.create({
    data: { userId, name: "Mon portefeuille", isDefault: true },
    select: { id: true, name: true, isDefault: true },
  });
}

// The active profile comes from a cookie; if it isn't set or doesn't
// belong to the current user, falls back to the user's default.
export async function getCurrentProfile(
  userId: string,
): Promise<CurrentProfile | null> {
  const store = await cookies();
  const cookieProfileId = store.get(ACTIVE_PROFILE_COOKIE)?.value;
  if (cookieProfileId) {
    const profile = await prisma.profile.findFirst({
      where: { id: cookieProfileId, userId },
      select: { id: true, name: true, isDefault: true },
    });
    if (profile) return profile;
  }
  return prisma.profile.findFirst({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, isDefault: true },
  });
}

// Every data-bearing route should call this — it pins the request to a
// single profile and guards against another user's profile being slipped
// in via the cookie.
export async function requireProfile(): Promise<CurrentSession> {
  const user = await requireUser();
  const profile =
    (await getCurrentProfile(user.id)) ?? (await ensureDefaultProfile(user.id));
  return { user, profile };
}

// Non-redirecting variant for route handlers — returns null when not
// authenticated so the caller can return a 401 JSON response.
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const profile =
    (await getCurrentProfile(user.id)) ?? (await ensureDefaultProfile(user.id));
  return { user, profile };
}

export async function setActiveProfile(profileId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_PROFILE_COOKIE, profileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearActiveProfile(): Promise<void> {
  const store = await cookies();
  store.delete(ACTIVE_PROFILE_COOKIE);
}

// Edge-safe session helpers (JWT only — no bcrypt, no Prisma).
// Imported by both middleware (edge runtime) and server code.
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "dev-insecure-secret-change-in-production",
);

export const SESSION_COOKIE_NAME = "ew_session";
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = {
  userId: string;
  email: string;
};

export async function createSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_COOKIE_MAX_AGE}s`)
    .sign(secret);
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    const { userId, email } = payload as Record<string, unknown>;
    if (typeof userId === "string" && typeof email === "string") {
      return { userId, email };
    }
    return null;
  } catch {
    return null;
  }
}

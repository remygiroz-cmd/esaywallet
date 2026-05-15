"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth-server";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE,
  createSessionToken,
} from "@/lib/auth";

export type AuthState = { error?: string };

const credentialsSchema = z.object({
  email: z.email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères"),
});

const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(1, "Le nom est requis").max(80),
});

async function startSession(userId: string, email: string): Promise<void> {
  const token = await createSessionToken({ userId, email });
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return { error: "Un compte existe déjà avec cet email" };
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      // Every account starts with a default profile — all data hangs off
      // it. Extra profiles (a child's, a partner's…) can be added later.
      profiles: {
        create: { name: "Mon portefeuille", isDefault: true },
      },
    },
  });

  await startSession(user.id, user.email);
  redirect("/dashboard");
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Email ou mot de passe invalide" };
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Email ou mot de passe incorrect" };
  }

  await startSession(user.id, user.email);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

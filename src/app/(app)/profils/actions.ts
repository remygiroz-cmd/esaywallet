"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  requireUser,
  setActiveProfile,
  clearActiveProfile,
} from "@/lib/auth-server";
import {
  createProfile,
  deleteProfile,
  renameProfile,
} from "@/lib/profiles";

const nameSchema = z.string().trim().min(1, "Nom requis").max(60);

export type ProfileFormState = {
  error?: string;
  ok?: boolean;
  submittedAt?: number;
};

export async function createProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nom invalide" };
  }
  const profile = await createProfile(user.id, parsed.data);
  // Switch to the new profile so the UI lands on it.
  await setActiveProfile(profile.id);
  revalidatePath("/profils");
  revalidatePath("/dashboard");
  return { ok: true, submittedAt: Date.now() };
}

export async function renameProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nom invalide" };
  }
  await renameProfile(id, user.id, parsed.data);
  revalidatePath("/profils");
  return { ok: true, submittedAt: Date.now() };
}

export async function deleteProfileAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) {
    const result = await deleteProfile(id, user.id);
    if (result.ok) {
      // If the deleted profile was the active one, drop the cookie so
      // the next request falls back to the user's default.
      await clearActiveProfile();
    }
  }
  revalidatePath("/profils");
  revalidatePath("/dashboard");
  redirect("/profils");
}


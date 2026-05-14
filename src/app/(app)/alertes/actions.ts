"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth-server";
import { ALERT_DIRECTIONS } from "@/lib/constants";
import { createAlert, deleteAlert, rearmAlert } from "@/lib/alerts";

export type AlertFormState = {
  error?: string;
  ok?: boolean;
  submittedAt?: number;
};

const alertSchema = z.object({
  assetId: z.string().min(1, "Sélectionnez un asset"),
  direction: z.enum(ALERT_DIRECTIONS),
  threshold: z.coerce.number().positive("Le seuil doit être positif"),
  note: z.string().trim().max(140),
});

export async function createAlertAction(
  _prev: AlertFormState,
  formData: FormData,
): Promise<AlertFormState> {
  const user = await requireUser();
  const parsed = alertSchema.safeParse({
    assetId: formData.get("assetId"),
    direction: formData.get("direction"),
    threshold: formData.get("threshold"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const alert = await createAlert(user.id, {
    assetId: parsed.data.assetId,
    direction: parsed.data.direction,
    threshold: parsed.data.threshold,
    note: parsed.data.note.trim() || null,
  });
  if (!alert) return { error: "Asset introuvable" };

  revalidatePath("/alertes");
  return { ok: true, submittedAt: Date.now() };
}

export async function deleteAlertAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) await deleteAlert(id, user.id);
  revalidatePath("/alertes");
  revalidatePath("/dashboard");
  redirect("/alertes");
}

export async function rearmAlertAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) await rearmAlert(id, user.id);
  revalidatePath("/alertes");
  revalidatePath("/dashboard");
  redirect("/alertes");
}

// Called from the dashboard banner: removes a triggered alert once the user
// has acknowledged it.
export async function dismissAlertAction(id: string): Promise<void> {
  const user = await requireUser();
  if (id) await deleteAlert(id, user.id);
  revalidatePath("/dashboard");
  revalidatePath("/alertes");
}

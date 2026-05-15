"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth-server";
import {
  createRealizedGainEntries,
  deleteRealizedGainEntry,
  type RealizedGainEntryInput,
} from "@/lib/realized-gains";

export type RealizedImportState = {
  error?: string;
  imported?: number;
  submittedAt?: number;
};

const payloadSchema = z.object({
  walletId: z.string().min(1, "Sélectionnez un wallet"),
  year: z.coerce.number().int().min(1990).max(2100),
  source: z.string().trim().max(120).optional(),
  rows: z
    .array(
      z.object({
        securityName: z.string().trim().min(1).max(160),
        securityCode: z.string().trim().max(40).nullable(),
        proceeds: z.number(),
        realizedGain: z.number(),
      }),
    )
    .min(1, "Aucune ligne à importer"),
});

export async function importRealizedGainsAction(
  _prev: RealizedImportState,
  formData: FormData,
): Promise<RealizedImportState> {
  const { profile } = await requireProfile();

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "Données d'import invalides." };
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Données d'import invalides.",
    };
  }

  const count = await createRealizedGainEntries(
    profile.id,
    parsed.data.walletId,
    parsed.data.year,
    parsed.data.source?.trim() || null,
    parsed.data.rows as RealizedGainEntryInput[],
  );
  if (count === null) return { error: "Wallet introuvable." };

  revalidatePath("/transactions/import");
  revalidatePath("/fiscalite");
  revalidatePath("/dashboard");
  return { imported: count, submittedAt: Date.now() };
}

export async function deleteRealizedGainEntryAction(
  formData: FormData,
): Promise<void> {
  const { profile } = await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (id) await deleteRealizedGainEntry(id, profile.id);
  revalidatePath("/transactions/import");
  revalidatePath("/fiscalite");
  revalidatePath("/dashboard");
  redirect("/transactions/import");
}

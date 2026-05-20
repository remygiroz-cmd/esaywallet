"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth-server";
import { SUPPORTED_CURRENCIES } from "@/lib/constants";
import { createDividend, deleteDividend } from "@/lib/dividends";

export type DividendFormState = {
  error?: string;
  ok?: boolean;
  submittedAt?: number;
};

const optionalId = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

const dividendSchema = z.object({
  walletId: optionalId,
  assetId: optionalId,
  source: z.string().trim().min(1, "Indiquez la source du dividende").max(120),
  receivedAt: z.coerce.date(),
  grossAmount: z.coerce.number().positive("Le montant brut doit être positif"),
  withheldTax: z.coerce
    .number()
    .nonnegative("L'impôt prélevé est invalide")
    .default(0),
  currency: z.enum(SUPPORTED_CURRENCIES),
  taxRate: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .refine(
      (value) => value === null || (Number.isFinite(value) && value >= 0 && value <= 1),
      "Le taux doit être entre 0 et 1 (ex: 0.30)",
    )
    .nullable(),
  notes: z.string().trim().max(280),
});

export async function createDividendAction(
  _prev: DividendFormState,
  formData: FormData,
): Promise<DividendFormState> {
  const { profile } = await requireProfile();
  const parsed = dividendSchema.safeParse({
    walletId: formData.get("walletId") ?? "",
    assetId: formData.get("assetId") ?? "",
    source: formData.get("source") ?? "",
    receivedAt: formData.get("receivedAt"),
    grossAmount: formData.get("grossAmount"),
    withheldTax: formData.get("withheldTax") ?? 0,
    currency: formData.get("currency") ?? "EUR",
    taxRate: formData.get("taxRate") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const dividend = await createDividend(profile.id, {
    walletId: parsed.data.walletId,
    assetId: parsed.data.assetId,
    source: parsed.data.source,
    receivedAt: parsed.data.receivedAt,
    grossAmount: parsed.data.grossAmount,
    withheldTax: parsed.data.withheldTax,
    currency: parsed.data.currency,
    taxRate: parsed.data.taxRate,
    notes: parsed.data.notes.trim() || null,
  });
  if (!dividend) return { error: "Wallet ou asset introuvable" };

  revalidatePath("/dividendes");
  revalidatePath("/fiscalite");
  return { ok: true, submittedAt: Date.now() };
}

export async function deleteDividendAction(formData: FormData): Promise<void> {
  const { profile } = await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteDividend(id, profile.id);
  }
  revalidatePath("/dividendes");
  revalidatePath("/fiscalite");
  redirect("/dividendes");
}

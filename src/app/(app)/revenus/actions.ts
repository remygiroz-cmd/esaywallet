"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth-server";
import { INCOME_KINDS } from "@/lib/constants";
import { createIncome, deleteIncome } from "@/lib/income";

export type IncomeFormState = {
  error?: string;
  ok?: boolean;
  submittedAt?: number;
};

const incomeSchema = z.object({
  walletId: z.string().min(1, "Sélectionnez un wallet"),
  assetId: z.string().min(1, "Sélectionnez un asset"),
  kind: z.enum(INCOME_KINDS),
  receivedAt: z.coerce.date(),
  amount: z.coerce.number().positive("Le montant doit être positif"),
  fees: z.coerce.number().nonnegative("Les frais sont invalides"),
  notes: z.string().trim().max(280),
});

export async function createIncomeAction(
  _prev: IncomeFormState,
  formData: FormData,
): Promise<IncomeFormState> {
  const { profile } = await requireProfile();
  const parsed = incomeSchema.safeParse({
    walletId: formData.get("walletId"),
    assetId: formData.get("assetId"),
    kind: formData.get("kind"),
    receivedAt: formData.get("receivedAt"),
    amount: formData.get("amount"),
    fees: formData.get("fees"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const income = await createIncome(profile.id, {
    walletId: parsed.data.walletId,
    assetId: parsed.data.assetId,
    kind: parsed.data.kind,
    receivedAt: parsed.data.receivedAt,
    amount: parsed.data.amount,
    fees: parsed.data.fees,
    notes: parsed.data.notes.trim() || null,
  });
  if (!income) return { error: "Wallet ou asset introuvable" };

  revalidatePath("/revenus");
  revalidatePath("/dashboard");
  revalidatePath("/fiscalite");
  return { ok: true, submittedAt: Date.now() };
}

export async function deleteIncomeAction(formData: FormData): Promise<void> {
  const { profile } = await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteIncome(id, profile.id);
  }
  revalidatePath("/revenus");
  revalidatePath("/dashboard");
  revalidatePath("/fiscalite");
  redirect("/revenus");
}

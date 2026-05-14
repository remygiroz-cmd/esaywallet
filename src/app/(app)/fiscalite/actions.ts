"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth-server";
import { upsertTaxAdjustment } from "@/lib/fiscalite";

export type TaxAdjustmentState = { error?: string; ok?: boolean };

const schema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  carryForwardLoss: z.coerce.number().min(0).max(100_000_000),
});

export async function saveTaxAdjustmentAction(
  _prev: TaxAdjustmentState,
  formData: FormData,
): Promise<TaxAdjustmentState> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    year: formData.get("year"),
    carryForwardLoss: formData.get("carryForwardLoss") || 0,
  });
  if (!parsed.success) {
    return { error: "Montant ou année invalide." };
  }

  await upsertTaxAdjustment(
    user.id,
    parsed.data.year,
    parsed.data.carryForwardLoss,
  );
  revalidatePath("/fiscalite");
  return { ok: true };
}

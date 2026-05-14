"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth-server";
import { WALLET_TYPES, SUPPORTED_CURRENCIES } from "@/lib/constants";
import { createWallet, updateWallet, deleteWallet } from "@/lib/wallets";

export type WalletFormState = {
  error?: string;
  ok?: boolean;
  // Changes on every successful create — used to remount and reset the form.
  submittedAt?: number;
};

const walletSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(60),
  type: z.enum(WALLET_TYPES),
  currency: z.enum(SUPPORTED_CURRENCIES),
  // Tax rate entered as a percentage string (e.g. "30"); "" = use default.
  taxRate: z.string().trim().max(10).optional(),
});

function parseWallet(formData: FormData) {
  return walletSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    currency: formData.get("currency"),
    taxRate: formData.get("taxRate") ?? "",
  });
}

// Percentage string -> ratio, or null when left blank / invalid.
function toTaxRate(raw: string | undefined): number | null {
  if (!raw) return null;
  const percent = Number(raw.replace(",", "."));
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  return percent / 100;
}

export async function createWalletAction(
  _prev: WalletFormState,
  formData: FormData,
): Promise<WalletFormState> {
  const user = await requireUser();
  const parsed = parseWallet(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  await createWallet(user.id, {
    name: parsed.data.name,
    type: parsed.data.type,
    currency: parsed.data.currency,
    taxRate: toTaxRate(parsed.data.taxRate),
  });
  revalidatePath("/wallets");
  return { ok: true, submittedAt: Date.now() };
}

export async function updateWalletAction(
  _prev: WalletFormState,
  formData: FormData,
): Promise<WalletFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Wallet introuvable" };
  const parsed = parseWallet(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  await updateWallet(id, user.id, {
    name: parsed.data.name,
    type: parsed.data.type,
    currency: parsed.data.currency,
    taxRate: toTaxRate(parsed.data.taxRate),
  });
  revalidatePath("/wallets");
  revalidatePath(`/wallets/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/fiscalite");
  return { ok: true };
}

export async function deleteWalletAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteWallet(id, user.id);
  }
  revalidatePath("/wallets");
  redirect("/wallets");
}

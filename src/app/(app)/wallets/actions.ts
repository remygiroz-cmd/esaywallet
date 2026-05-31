"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth-server";
import {
  WALLET_TYPES,
  SUPPORTED_CURRENCIES,
  CASH_MOVEMENT_KINDS,
} from "@/lib/constants";
import { createWallet, updateWallet, deleteWallet } from "@/lib/wallets";
import { createCashMovement, deleteCashMovement } from "@/lib/cash";

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
  // Account opening date (YYYY-MM-DD); "" = unknown.
  openedAt: z.string().trim().max(10).optional(),
  // Manual overrides, in the wallet currency; "" = compute the figure.
  manualDeposits: z.string().trim().max(20).optional(),
  manualCash: z.string().trim().max(20).optional(),
});

function parseWallet(formData: FormData) {
  return walletSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    currency: formData.get("currency"),
    taxRate: formData.get("taxRate") ?? "",
    openedAt: formData.get("openedAt") ?? "",
    manualDeposits: formData.get("manualDeposits") ?? "",
    manualCash: formData.get("manualCash") ?? "",
  });
}

// Percentage string -> ratio, or null when left blank / invalid.
function toTaxRate(raw: string | undefined): number | null {
  if (!raw) return null;
  const percent = Number(raw.replace(",", "."));
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  return percent / 100;
}

// Date input string -> Date, or null when left blank / invalid.
function toOpenedAt(raw: string | undefined): Date | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Number string -> override value, or null when left blank (= compute it).
// Negative values are allowed: a cash balance can legitimately be negative.
function toManualOverride(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export async function createWalletAction(
  _prev: WalletFormState,
  formData: FormData,
): Promise<WalletFormState> {
  const { profile } = await requireProfile();
  const parsed = parseWallet(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  await createWallet(profile.id, {
    name: parsed.data.name,
    type: parsed.data.type,
    currency: parsed.data.currency,
    taxRate: toTaxRate(parsed.data.taxRate),
    openedAt: toOpenedAt(parsed.data.openedAt),
    manualDeposits: toManualOverride(parsed.data.manualDeposits),
    manualCash: toManualOverride(parsed.data.manualCash),
  });
  revalidatePath("/wallets");
  return { ok: true, submittedAt: Date.now() };
}

export async function updateWalletAction(
  _prev: WalletFormState,
  formData: FormData,
): Promise<WalletFormState> {
  const { profile } = await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Wallet introuvable" };
  const parsed = parseWallet(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  await updateWallet(id, profile.id, {
    name: parsed.data.name,
    type: parsed.data.type,
    currency: parsed.data.currency,
    taxRate: toTaxRate(parsed.data.taxRate),
    openedAt: toOpenedAt(parsed.data.openedAt),
    manualDeposits: toManualOverride(parsed.data.manualDeposits),
    manualCash: toManualOverride(parsed.data.manualCash),
  });
  revalidatePath("/wallets");
  revalidatePath(`/wallets/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/fiscalite");
  return { ok: true };
}

export async function deleteWalletAction(formData: FormData): Promise<void> {
  const { profile } = await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteWallet(id, profile.id);
  }
  revalidatePath("/wallets");
  redirect("/wallets");
}

export type CashMovementFormState = {
  error?: string;
  ok?: boolean;
  submittedAt?: number;
};

const cashMovementSchema = z.object({
  walletId: z.string().min(1, "Wallet introuvable"),
  kind: z.enum(CASH_MOVEMENT_KINDS),
  amount: z.coerce.number().positive("Le montant doit être positif"),
  occurredAt: z.coerce.date(),
  note: z.string().trim().max(140),
});

export async function createCashMovementAction(
  _prev: CashMovementFormState,
  formData: FormData,
): Promise<CashMovementFormState> {
  const { profile } = await requireProfile();
  const parsed = cashMovementSchema.safeParse({
    walletId: formData.get("walletId"),
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    occurredAt: formData.get("occurredAt"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const movement = await createCashMovement(parsed.data.walletId, profile.id, {
    kind: parsed.data.kind,
    amount: parsed.data.amount,
    occurredAt: parsed.data.occurredAt,
    note: parsed.data.note.trim() || null,
  });
  if (!movement) return { error: "Wallet introuvable" };

  revalidatePath(`/wallets/${parsed.data.walletId}`);
  revalidatePath("/dashboard");
  return { ok: true, submittedAt: Date.now() };
}

export async function deleteCashMovementAction(
  formData: FormData,
): Promise<void> {
  const { profile } = await requireProfile();
  const id = String(formData.get("id") ?? "");
  const walletId = String(formData.get("walletId") ?? "");
  if (id) await deleteCashMovement(id, profile.id);
  revalidatePath("/dashboard");
  if (walletId) {
    revalidatePath(`/wallets/${walletId}`);
    redirect(`/wallets/${walletId}`);
  }
  redirect("/wallets");
}

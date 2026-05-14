"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth-server";
import {
  ASSET_TYPES,
  SUPPORTED_CURRENCIES,
  TRANSACTION_TYPES,
} from "@/lib/constants";
import { upsertAsset } from "@/lib/assets";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  createTransactionsBulk,
  deleteTransactionsBulk,
} from "@/lib/transactions";
import { parseTransactionRows } from "@/lib/import";

export type TransactionFormState = {
  error?: string;
  ok?: boolean;
  // Changes on every successful create — used to remount and reset the form.
  submittedAt?: number;
};

const txSchema = z.object({
  walletId: z.string().min(1, "Sélectionnez un wallet"),
  type: z.enum(TRANSACTION_TYPES),
  executedAt: z.coerce.date(),
  unitPrice: z.coerce.number().positive("Le prix d'achat doit être positif"),
  quantity: z.coerce.number().positive("La quantité doit être positive"),
  amountInvested: z.coerce
    .number()
    .nonnegative("Le montant investi est invalide"),
  fees: z.coerce.number().nonnegative("Les frais sont invalides"),
  notes: z.string().trim().max(280),
});

const newAssetSchema = z.object({
  name: z.string().trim().min(1, "Nom de l'asset requis").max(80),
  symbol: z.string().trim().min(1, "Symbole de l'asset requis").max(20),
  type: z.enum(ASSET_TYPES),
  quoteCurrency: z.enum(SUPPORTED_CURRENCIES),
  externalId: z.string().trim().max(120),
});

function parseTransaction(formData: FormData) {
  return txSchema.safeParse({
    walletId: formData.get("walletId"),
    type: formData.get("type"),
    executedAt: formData.get("executedAt"),
    unitPrice: formData.get("unitPrice"),
    quantity: formData.get("quantity"),
    amountInvested: formData.get("amountInvested"),
    fees: formData.get("fees"),
    notes: formData.get("notes") ?? "",
  });
}

// The transaction form can either reference an existing asset or define a
// brand new one inline. This resolves both cases to a single asset id.
async function resolveAssetId(
  userId: string,
  formData: FormData,
): Promise<{ assetId: string } | { error: string }> {
  if (formData.get("assetMode") === "new") {
    const parsed = newAssetSchema.safeParse({
      name: formData.get("assetName"),
      symbol: formData.get("assetSymbol"),
      type: formData.get("assetType"),
      quoteCurrency: formData.get("assetQuoteCurrency"),
      externalId: formData.get("assetExternalId") ?? "",
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Asset invalide" };
    }
    const externalId = parsed.data.externalId.trim() || null;
    const asset = await upsertAsset(userId, {
      name: parsed.data.name,
      symbol: parsed.data.symbol.toUpperCase(),
      type: parsed.data.type,
      quoteCurrency: parsed.data.quoteCurrency,
      coingeckoId: parsed.data.type === "CRYPTO" ? externalId : null,
      yahooSymbol: parsed.data.type === "CRYPTO" ? null : externalId,
    });
    return { assetId: asset.id };
  }

  const assetId = String(formData.get("assetId") ?? "");
  if (!assetId) return { error: "Sélectionnez un asset" };
  return { assetId };
}

export async function createTransactionAction(
  _prev: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const user = await requireUser();
  const parsed = parseTransaction(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  if (parsed.data.type === "SELL" && formData.get("assetMode") === "new") {
    return { error: "Un asset doit déjà exister pour être vendu." };
  }

  const assetResult = await resolveAssetId(user.id, formData);
  if ("error" in assetResult) return { error: assetResult.error };

  const tx = await createTransaction(user.id, {
    walletId: parsed.data.walletId,
    assetId: assetResult.assetId,
    type: parsed.data.type,
    executedAt: parsed.data.executedAt,
    unitPrice: parsed.data.unitPrice,
    quantity: parsed.data.quantity,
    amountInvested: parsed.data.amountInvested,
    fees: parsed.data.fees,
    notes: parsed.data.notes.trim() || null,
  });
  if (!tx) return { error: "Wallet ou asset introuvable" };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath(`/wallets/${parsed.data.walletId}`);
  return { ok: true, submittedAt: Date.now() };
}

export async function updateTransactionAction(
  _prev: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Transaction introuvable" };

  const parsed = parseTransaction(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  if (parsed.data.type === "SELL" && formData.get("assetMode") === "new") {
    return { error: "Un asset doit déjà exister pour être vendu." };
  }

  const assetResult = await resolveAssetId(user.id, formData);
  if ("error" in assetResult) return { error: assetResult.error };

  const tx = await updateTransaction(id, user.id, {
    walletId: parsed.data.walletId,
    assetId: assetResult.assetId,
    type: parsed.data.type,
    executedAt: parsed.data.executedAt,
    unitPrice: parsed.data.unitPrice,
    quantity: parsed.data.quantity,
    amountInvested: parsed.data.amountInvested,
    fees: parsed.data.fees,
    notes: parsed.data.notes.trim() || null,
  });
  if (!tx) return { error: "Transaction, wallet ou asset introuvable" };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath(`/wallets/${parsed.data.walletId}`);
  redirect("/transactions");
}

export async function deleteTransactionAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await deleteTransaction(id, user.id);
  }
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  redirect("/transactions");
}

export type BulkDeleteState = {
  error?: string;
  deleted?: number;
  submittedAt?: number;
};

export async function deleteTransactionsBulkAction(
  _prev: BulkDeleteState,
  formData: FormData,
): Promise<BulkDeleteState> {
  const user = await requireUser();
  const ids = formData
    .getAll("ids")
    .map((value) => String(value))
    .filter(Boolean);

  if (ids.length === 0) {
    return { error: "Aucune transaction sélectionnée." };
  }

  const deleted = await deleteTransactionsBulk(user.id, ids);
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/wallets/[id]", "page");
  return { deleted, submittedAt: Date.now() };
}

export type ImportFormState = {
  error?: string;
  imported?: number;
  submittedAt?: number;
};

export async function importTransactionsAction(
  _prev: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const user = await requireUser();
  const walletId = String(formData.get("walletId") ?? "");
  const assetId = String(formData.get("assetId") ?? "");
  const text = String(formData.get("data") ?? "");

  if (!walletId || !assetId) {
    return { error: "Sélectionnez un wallet et un asset." };
  }

  const { rows } = parseTransactionRows(text);
  if (rows.length === 0) {
    return {
      error:
        "Aucune ligne valide détectée. Vérifiez l'ordre des colonnes collées.",
    };
  }

  const count = await createTransactionsBulk(
    user.id,
    walletId,
    assetId,
    rows.map((row) => ({
      type: row.type,
      executedAt: new Date(row.executedAt),
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      amountInvested: row.amountInvested,
      fees: row.fees,
    })),
  );
  if (count === null) {
    return { error: "Wallet ou asset introuvable." };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath(`/wallets/${walletId}`);
  return { imported: count, submittedAt: Date.now() };
}

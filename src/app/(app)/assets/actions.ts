"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth-server";
import { ASSET_TYPES, SUPPORTED_CURRENCIES } from "@/lib/constants";
import {
  getAsset,
  upsertAsset,
  updateAsset,
  deleteAsset,
  type AssetInput,
} from "@/lib/assets";

export type AssetFormState = {
  error?: string;
  ok?: boolean;
  // Changes on every successful create — used to remount and reset the form.
  submittedAt?: number;
};

const assetSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(80),
  symbol: z.string().trim().min(1, "Le symbole est requis").max(20),
  type: z.enum(ASSET_TYPES),
  quoteCurrency: z.enum(SUPPORTED_CURRENCIES),
  externalId: z.string().trim().max(120).optional(),
});

function parseAsset(formData: FormData) {
  return assetSchema.safeParse({
    name: formData.get("name"),
    symbol: formData.get("symbol"),
    type: formData.get("type"),
    quoteCurrency: formData.get("quoteCurrency"),
    externalId: formData.get("externalId"),
  });
}

function toAssetInput(data: z.infer<typeof assetSchema>): AssetInput {
  const externalId = data.externalId?.trim() || null;
  return {
    name: data.name,
    symbol: data.symbol.toUpperCase(),
    type: data.type,
    quoteCurrency: data.quoteCurrency,
    // Crypto prices come from CoinGecko, everything else from Yahoo Finance.
    coingeckoId: data.type === "CRYPTO" ? externalId : null,
    yahooSymbol: data.type === "CRYPTO" ? null : externalId,
  };
}

export async function createAssetAction(
  _prev: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const { profile } = await requireProfile();
  const parsed = parseAsset(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  await upsertAsset(profile.id, toAssetInput(parsed.data));
  revalidatePath("/assets");
  revalidatePath("/transactions");
  return { ok: true, submittedAt: Date.now() };
}

export async function updateAssetAction(
  _prev: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const { profile } = await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Asset introuvable" };
  const parsed = parseAsset(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  await updateAsset(id, profile.id, toAssetInput(parsed.data));
  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteAssetAction(formData: FormData): Promise<void> {
  const { profile } = await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (id) {
    const asset = await getAsset(id, profile.id);
    // An asset that still has transactions cannot be deleted.
    if (asset && asset._count.transactions === 0) {
      await deleteAsset(id, profile.id);
    }
  }
  revalidatePath("/assets");
  redirect("/assets");
}

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
  createBulkTransactions,
  deleteTransactionsBulk,
  moveAssetTransactions,
} from "@/lib/transactions";
import { parseTransactionRows } from "@/lib/import";
import { parseCmcCsv } from "@/lib/import-cmc";
import { parseTrCsv } from "@/lib/import-tr";
import { parseGenericCsv, type GenericMapping } from "@/lib/import-generic";
import {
  resolveCoingeckoId,
  resolveYahooSymbol,
  resolveGenericAsset,
} from "@/lib/prices/search";

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
  // Checkbox: absent (null) → false, present ("on") → true.
  taxExempt: z.coerce.boolean(),
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
    taxExempt: formData.get("taxExempt"),
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
    // Only a SELL can be a non-taxable disposal.
    taxExempt: parsed.data.type === "SELL" && parsed.data.taxExempt,
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
    taxExempt: parsed.data.type === "SELL" && parsed.data.taxExempt,
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

// Moves an asset's whole position from one wallet to another. Called
// imperatively (e.g. from a drag-and-drop handler), not via a form.
export async function moveAssetWalletAction(
  assetId: string,
  fromWalletId: string,
  toWalletId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const moved = await moveAssetTransactions(
    user.id,
    assetId,
    fromWalletId,
    toWalletId,
  );
  if (!moved) {
    return { ok: false, error: "Déplacement impossible." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/assets");
  revalidatePath("/wallets/[id]", "page");
  return { ok: true };
}

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

// Shared result shape for the broker-file importers (CoinMarketCap,
// Trade Republic): they create one wallet's worth of transactions across
// many auto-created assets.
export type BulkImportState = {
  error?: string;
  imported?: number;
  assetsCount?: number;
  resolvedCount?: number;
  submittedAt?: number;
};

// Imports a CoinMarketCap "transaction history" CSV. Every row is crypto,
// so it all routes to the chosen crypto wallet. Each token symbol is
// resolved to a CoinGecko id so live prices work straight away.
export async function importCmcAction(
  _prev: BulkImportState,
  formData: FormData,
): Promise<BulkImportState> {
  const user = await requireUser();
  const text = String(formData.get("data") ?? "");

  const { rows } = parseCmcCsv(text);
  if (rows.length === 0) {
    return {
      error: "Aucune transaction valide trouvée dans le fichier.",
    };
  }

  const tokens = [...new Set(rows.map((row) => row.token))];

  // One destination wallet per token, assigned in the review step.
  const walletByToken = new Map<string, string>();
  for (const token of tokens) {
    const walletId = String(formData.get(`wallet_${token}`) ?? "");
    if (!walletId) {
      return { error: `Sélectionnez un wallet pour ${token}.` };
    }
    walletByToken.set(token, walletId);
  }

  const resolutions = await Promise.allSettled(
    tokens.map((token) => resolveCoingeckoId(token)),
  );
  const resolvedByToken = new Map<string, { id: string; name: string }>();
  tokens.forEach((token, index) => {
    const result = resolutions[index];
    if (result.status === "fulfilled" && result.value) {
      resolvedByToken.set(token, result.value);
    }
  });

  const assetIdByToken = new Map<string, string>();
  for (const token of tokens) {
    const resolved = resolvedByToken.get(token);
    const asset = await upsertAsset(user.id, {
      symbol: token,
      name: resolved?.name ?? token,
      type: "CRYPTO",
      quoteCurrency: "EUR",
      coingeckoId: resolved?.id ?? null,
      yahooSymbol: null,
    });
    assetIdByToken.set(token, asset.id);
  }

  const count = await createBulkTransactions(
    user.id,
    rows.map((row) => ({
      walletId: walletByToken.get(row.token) as string,
      assetId: assetIdByToken.get(row.token) as string,
      type: row.type,
      executedAt: new Date(row.executedAt),
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      amountInvested: row.amountInvested,
      fees: row.fees,
    })),
  );
  if (count === null) return { error: "Wallet introuvable." };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/assets");
  revalidatePath("/wallets/[id]", "page");
  return {
    imported: count,
    assetsCount: tokens.length,
    resolvedCount: resolvedByToken.size,
    submittedAt: Date.now(),
  };
}

// Imports a Trade Republic transaction-history CSV. Securities are
// identified by ISIN, which is resolved to a Yahoo Finance symbol so live
// prices work straight away. Each security is routed to the wallet chosen
// for it in the review step.
export async function importTrAction(
  _prev: BulkImportState,
  formData: FormData,
): Promise<BulkImportState> {
  const user = await requireUser();
  const text = String(formData.get("data") ?? "");

  const { rows } = parseTrCsv(text);
  if (rows.length === 0) {
    return { error: "Aucune transaction valide trouvée dans le fichier." };
  }

  // Group rows by ISIN so each security is resolved and created once.
  const rowsByIsin = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = rowsByIsin.get(row.isin);
    if (list) list.push(row);
    else rowsByIsin.set(row.isin, [row]);
  }
  const isins = [...rowsByIsin.keys()];

  // One destination wallet per security, assigned in the review step.
  const walletByIsin = new Map<string, string>();
  for (const isin of isins) {
    const walletId = String(formData.get(`wallet_${isin}`) ?? "");
    if (!walletId) {
      const sample = (rowsByIsin.get(isin) as typeof rows)[0];
      return {
        error: `Sélectionnez un wallet pour ${sample.name || isin}.`,
      };
    }
    walletByIsin.set(isin, walletId);
  }

  const resolutions = await Promise.allSettled(
    isins.map((isin) => resolveYahooSymbol(isin)),
  );
  const resolvedByIsin = new Map<string, { symbol: string; name: string }>();
  isins.forEach((isin, index) => {
    const result = resolutions[index];
    if (result.status === "fulfilled" && result.value) {
      resolvedByIsin.set(isin, result.value);
    }
  });

  const assetIdByIsin = new Map<string, string>();
  for (const isin of isins) {
    const sample = (rowsByIsin.get(isin) as typeof rows)[0];
    const resolved = resolvedByIsin.get(isin);
    const asset = await upsertAsset(user.id, {
      symbol: resolved?.symbol ?? isin,
      name: sample.name || resolved?.name || isin,
      type: sample.assetType,
      quoteCurrency: sample.currency || "EUR",
      coingeckoId: null,
      yahooSymbol: resolved?.symbol ?? null,
    });
    assetIdByIsin.set(isin, asset.id);
  }

  const count = await createBulkTransactions(
    user.id,
    rows.map((row) => ({
      walletId: walletByIsin.get(row.isin) as string,
      assetId: assetIdByIsin.get(row.isin) as string,
      type: row.type,
      executedAt: new Date(row.executedAt),
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      amountInvested: row.amountInvested,
      fees: row.fees,
    })),
  );
  if (count === null) return { error: "Wallet introuvable." };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/assets");
  revalidatePath("/wallets/[id]", "page");
  return {
    imported: count,
    assetsCount: isins.length,
    resolvedCount: resolvedByIsin.size,
    submittedAt: Date.now(),
  };
}

// Universal importer: parses any CSV against a user-confirmed column
// mapping, resolves every identifier to a price provider, and routes each
// asset to the wallet chosen in the review step.
export async function importGenericAction(
  _prev: BulkImportState,
  formData: FormData,
): Promise<BulkImportState> {
  const user = await requireUser();
  const text = String(formData.get("data") ?? "");

  let mapping: GenericMapping;
  try {
    mapping = JSON.parse(String(formData.get("mapping") ?? "")) as GenericMapping;
  } catch {
    return { error: "Configuration des colonnes invalide." };
  }

  const { rows } = parseGenericCsv(text, mapping);
  if (rows.length === 0) {
    return {
      error:
        "Aucune transaction valide — vérifiez l'association des colonnes.",
    };
  }

  // Group rows by symbol so each asset is resolved and created once.
  const rowsBySymbol = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = rowsBySymbol.get(row.symbol);
    if (list) list.push(row);
    else rowsBySymbol.set(row.symbol, [row]);
  }
  const symbols = [...rowsBySymbol.keys()];

  // One destination wallet per asset, assigned in the review step.
  const walletBySymbol = new Map<string, string>();
  for (const symbol of symbols) {
    const walletId = String(formData.get(`wallet_${symbol}`) ?? "");
    if (!walletId) {
      return { error: `Sélectionnez un wallet pour ${symbol}.` };
    }
    walletBySymbol.set(symbol, walletId);
  }

  const resolutions = await Promise.allSettled(
    symbols.map((symbol) => {
      const sample = (rowsBySymbol.get(symbol) as typeof rows)[0];
      return resolveGenericAsset(
        symbol,
        mapping.assetKind,
        sample.assetClass,
        sample.name,
        sample.currency,
      );
    }),
  );

  const assetIdBySymbol = new Map<string, string>();
  let resolvedCount = 0;
  for (let i = 0; i < symbols.length; i += 1) {
    const symbol = symbols[i];
    const sample = (rowsBySymbol.get(symbol) as typeof rows)[0];
    const result = resolutions[i];
    const resolved =
      result.status === "fulfilled"
        ? result.value
        : {
            symbol,
            name: sample.name,
            type: "STOCK" as const,
            quoteCurrency: sample.currency || "EUR",
            coingeckoId: null,
            yahooSymbol: null,
          };
    if (resolved.coingeckoId || resolved.yahooSymbol) resolvedCount += 1;

    const asset = await upsertAsset(user.id, {
      symbol: resolved.symbol,
      name: resolved.name,
      type: resolved.type,
      quoteCurrency: resolved.quoteCurrency,
      coingeckoId: resolved.coingeckoId,
      yahooSymbol: resolved.yahooSymbol,
    });
    assetIdBySymbol.set(symbol, asset.id);
  }

  const count = await createBulkTransactions(
    user.id,
    rows.map((row) => ({
      walletId: walletBySymbol.get(row.symbol) as string,
      assetId: assetIdBySymbol.get(row.symbol) as string,
      type: row.type,
      executedAt: new Date(row.executedAt),
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      amountInvested: row.amountInvested,
      fees: row.fees,
    })),
  );
  if (count === null) return { error: "Wallet introuvable." };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/assets");
  revalidatePath("/wallets/[id]", "page");
  return {
    imported: count,
    assetsCount: symbols.length,
    resolvedCount,
    submittedAt: Date.now(),
  };
}

"use client";

import { useMemo, useRef, useState } from "react";
import {
  ASSET_TYPES,
  SUPPORTED_CURRENCIES,
  type AssetType,
  type SupportedCurrency,
} from "@/lib/constants";
import { ui } from "@/lib/ui";
import { toDateInputValue } from "@/lib/format";
import { TransactionForm, type TransactionPrefill } from "./transaction-form";

type WalletOption = {
  id: string;
  name: string;
  currency: string;
};

type AssetOption = {
  id: string;
  name: string;
  symbol: string;
  quoteCurrency: string;
};

type Extraction = {
  type: "BUY" | "SELL" | "UNKNOWN";
  executedAt: string | null;
  assetSymbol: string | null;
  assetName: string | null;
  assetKind: AssetType | "UNKNOWN";
  quantity: number | null;
  unitPrice: number | null;
  amountInvested: number | null;
  currency: SupportedCurrency | "UNKNOWN";
  fees: number | null;
  confidence: "low" | "medium" | "high";
  source: string | null;
  warnings: string[];
};

type ScreenshotImportProps = {
  wallets: WalletOption[];
  assets: AssetOption[];
};

const CONFIDENCE_LABEL: Record<Extraction["confidence"], string> = {
  high: "Confiance élevée",
  medium: "Confiance moyenne",
  low: "Confiance faible",
};

const CONFIDENCE_CLASS: Record<Extraction["confidence"], string> = {
  high: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function matchExistingAsset(
  assets: AssetOption[],
  symbol: string | null,
  name: string | null,
): AssetOption | null {
  if (symbol) {
    const target = symbol.trim().toUpperCase();
    const bySymbol = assets.find((a) => a.symbol.toUpperCase() === target);
    if (bySymbol) return bySymbol;
  }
  if (name) {
    const target = name.trim().toLowerCase();
    const byName = assets.find((a) => a.name.toLowerCase() === target);
    if (byName) return byName;
  }
  return null;
}

function buildPrefill(
  extraction: Extraction,
  assets: AssetOption[],
): TransactionPrefill {
  const type =
    extraction.type === "BUY" || extraction.type === "SELL"
      ? extraction.type
      : undefined;

  const matched = matchExistingAsset(
    assets,
    extraction.assetSymbol,
    extraction.assetName,
  );

  const note = extraction.source
    ? `Importé depuis ${extraction.source} via capture d'écran`
    : "Importé via capture d'écran";

  const prefill: TransactionPrefill = {
    type,
    executedAt: extraction.executedAt ?? undefined,
    unitPrice: extraction.unitPrice ?? undefined,
    quantity: extraction.quantity ?? undefined,
    amountInvested: extraction.amountInvested ?? undefined,
    fees: extraction.fees ?? undefined,
    notes: note,
  };

  if (matched) {
    prefill.assetId = matched.id;
  } else if (extraction.assetSymbol || extraction.assetName) {
    const assetType: string =
      extraction.assetKind !== "UNKNOWN" ? extraction.assetKind : "STOCK";
    const currency: string =
      extraction.currency !== "UNKNOWN" ? extraction.currency : "EUR";
    prefill.newAsset = {
      name: extraction.assetName ?? extraction.assetSymbol ?? "",
      symbol: (extraction.assetSymbol ?? extraction.assetName ?? "")
        .trim()
        .toUpperCase()
        .slice(0, 20),
      type: ASSET_TYPES.includes(assetType as AssetType) ? assetType : "STOCK",
      quoteCurrency: SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency)
        ? currency
        : "EUR",
    };
  }

  return prefill;
}

export function ScreenshotImport({ wallets, assets }: ScreenshotImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);

  const defaultDate = useMemo(() => toDateInputValue(new Date()), []);

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    await runExtraction(file);
  }

  async function runExtraction(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setExtraction(null);
    setError(null);
    setPending(true);

    // Pre-compute natural size so next/image renders the preview at a
    // sensible aspect ratio.
    const img = new window.Image();
    img.onload = () =>
      setPreviewSize({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = objectUrl;

    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch("/api/transactions/extract-screenshot", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json().catch(() => null)) as
        | { extraction?: Extraction; error?: string }
        | null;
      if (!response.ok || !body?.extraction) {
        setError(body?.error ?? "L'extraction a échoué.");
        return;
      }
      setExtraction(body.extraction);
    } catch {
      setError("L'extraction a échoué — vérifiez votre connexion.");
    } finally {
      setPending(false);
    }
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewSize(null);
    setExtraction(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const prefill = extraction ? buildPrefill(extraction, assets) : null;
  const matchedAssetId = prefill?.assetId
    ? assets.find((a) => a.id === prefill.assetId)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className={`${ui.card} flex flex-col gap-4`}>
        <label className={ui.label}>
          Capture d&apos;écran (PNG, JPEG, WebP — 8 Mo max)
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFileChange}
            disabled={pending}
            className="w-full rounded-lg border border-black/[.12] bg-white px-3 py-2 text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white disabled:opacity-60 dark:border-white/[.16] dark:bg-black dark:text-zinc-300"
          />
          <span className="text-xs font-normal text-zinc-400">
            Confirmation d&apos;achat broker, écran d&apos;app crypto, mail
            d&apos;exécution… Une transaction à la fois.
          </span>
        </label>

        {pending ? (
          <p className={ui.subtle}>Lecture de la capture en cours…</p>
        ) : null}
        {error ? <p className={ui.errorText}>{error}</p> : null}
      </div>

      {previewUrl ? (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className={`${ui.card} flex flex-col gap-2`}>
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Capture
            </span>
            <div className="overflow-hidden rounded-lg border border-black/[.08] dark:border-white/[.12]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Capture importée"
                width={previewSize?.width}
                height={previewSize?.height}
                className="h-auto w-full"
              />
            </div>
            <button
              type="button"
              onClick={reset}
              className={`${ui.secondaryButton} self-start`}
            >
              Choisir une autre capture
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {extraction ? (
              <ExtractionSummary
                extraction={extraction}
                matchedAssetName={matchedAssetId?.name ?? null}
              />
            ) : null}

            {prefill && wallets.length > 0 ? (
              <TransactionForm
                wallets={wallets}
                assets={assets}
                defaultDate={defaultDate}
                prefill={prefill}
                redirectTo="/transactions"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExtractionSummary({
  extraction,
  matchedAssetName,
}: {
  extraction: Extraction;
  matchedAssetName: string | null;
}) {
  return (
    <div className={`${ui.card} flex flex-col gap-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CONFIDENCE_CLASS[extraction.confidence]}`}
        >
          {CONFIDENCE_LABEL[extraction.confidence]}
        </span>
        {extraction.source ? (
          <span className={ui.subtle}>Source détectée : {extraction.source}</span>
        ) : null}
      </div>
      <p className={ui.subtle}>
        Champs détectés sur la capture — vérifie chaque valeur ci-dessous avant
        d&apos;enregistrer.
        {matchedAssetName ? (
          <>
            {" "}
            L&apos;asset <strong>{matchedAssetName}</strong> existe déjà dans
            ton portefeuille, il a été pré-sélectionné.
          </>
        ) : extraction.assetSymbol || extraction.assetName ? (
          <>
            {" "}
            Aucun asset existant ne correspond — un nouvel asset sera créé.
          </>
        ) : null}
      </p>
      {extraction.warnings.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {extraction.warnings.map((warning, i) => (
            <li key={i}>• {warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

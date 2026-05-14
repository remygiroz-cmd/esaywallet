"use client";

import { useActionState, useState } from "react";
import {
  createAssetAction,
  updateAssetAction,
  type AssetFormState,
} from "@/app/(app)/assets/actions";
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  SUPPORTED_CURRENCIES,
} from "@/lib/constants";
import { ui } from "@/lib/ui";

type AssetValues = {
  id: string;
  name: string;
  symbol: string;
  type: string;
  quoteCurrency: string;
  coingeckoId: string | null;
  yahooSymbol: string | null;
};

type AssetFormProps = { asset?: AssetValues };

const initialState: AssetFormState = {};

export function AssetForm({ asset }: AssetFormProps) {
  const editing = Boolean(asset);
  const [state, formAction, pending] = useActionState(
    editing ? updateAssetAction : createAssetAction,
    initialState,
  );

  return (
    // After a successful create the action returns a fresh `submittedAt`,
    // which remounts the body and resets every field.
    <AssetFormBody
      key={state.submittedAt ?? "initial"}
      asset={asset}
      editing={editing}
      formAction={formAction}
      pending={pending}
      error={state.error}
      saved={Boolean(state.ok) && editing}
    />
  );
}

function AssetFormBody({
  asset,
  editing,
  formAction,
  pending,
  error,
  saved,
}: {
  asset?: AssetValues;
  editing: boolean;
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
  saved: boolean;
}) {
  const [type, setType] = useState(asset?.type ?? "STOCK");

  const isCrypto = type === "CRYPTO";
  const externalIdDefault =
    (asset
      ? asset.type === "CRYPTO"
        ? asset.coingeckoId
        : asset.yahooSymbol
      : "") ?? "";

  return (
    <form action={formAction} className={`${ui.card} flex flex-col gap-4`}>
      {asset ? <input type="hidden" name="id" value={asset.id} /> : null}

      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} flex-1`}>
          Nom
          <input
            name="name"
            type="text"
            required
            maxLength={80}
            defaultValue={asset?.name}
            placeholder="Ex. Apple, Bitcoin, MSCI World"
            className={ui.input}
          />
        </label>
        <label className={`${ui.label} sm:w-40`}>
          Symbole
          <input
            name="symbol"
            type="text"
            required
            maxLength={20}
            defaultValue={asset?.symbol}
            placeholder="AAPL, BTC, CW8"
            className={`${ui.input} uppercase`}
          />
        </label>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} flex-1`}>
          Type
          <select
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className={ui.input}
          >
            {ASSET_TYPES.map((assetType) => (
              <option key={assetType} value={assetType}>
                {ASSET_TYPE_LABELS[assetType]}
              </option>
            ))}
          </select>
        </label>
        <label className={`${ui.label} sm:w-32`}>
          Devise de cotation
          <select
            name="quoteCurrency"
            defaultValue={asset?.quoteCurrency ?? "EUR"}
            className={ui.input}
          >
            {SUPPORTED_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={ui.label}>
        {isCrypto ? "Identifiant CoinGecko" : "Symbole Yahoo Finance"}
        <input
          name="externalId"
          type="text"
          maxLength={120}
          defaultValue={externalIdDefault}
          placeholder={isCrypto ? "ex. bitcoin, ethereum" : "ex. AAPL, CW8.PA"}
          className={ui.input}
        />
        <span className="text-xs font-normal text-zinc-400">
          {isCrypto
            ? "Identifiant utilisé par l'API CoinGecko pour récupérer le prix en direct."
            : "Symbole utilisé par Yahoo Finance (suffixe de place inclus, ex. .PA pour Euronext Paris)."}
        </span>
      </label>

      {error ? <p className={ui.errorText}>{error}</p> : null}
      {saved ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Modifications enregistrées.
        </p>
      ) : null}

      <div>
        <button type="submit" disabled={pending} className={ui.primaryButton}>
          {pending
            ? "Enregistrement…"
            : editing
              ? "Enregistrer"
              : "Ajouter l'asset"}
        </button>
      </div>
    </form>
  );
}

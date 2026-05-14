"use client";

import { useActionState, useState } from "react";
import {
  createTransactionAction,
  updateTransactionAction,
  type TransactionFormState,
} from "@/app/(app)/transactions/actions";
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  SUPPORTED_CURRENCIES,
} from "@/lib/constants";
import { ui } from "@/lib/ui";
import { AssetSearch, type AssetSearchSelection } from "./asset-search";

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

type TransactionValues = {
  id: string;
  walletId: string;
  assetId: string;
  type: string;
  executedAt: string;
  unitPrice: number;
  quantity: number;
  amountInvested: number;
  fees: number;
  notes: string | null;
};

type TransactionFormProps = {
  wallets: WalletOption[];
  assets: AssetOption[];
  defaultDate: string;
  transaction?: TransactionValues;
};

const NEW_ASSET = "__new__";
const initialState: TransactionFormState = {};

export function TransactionForm(props: TransactionFormProps) {
  const editing = Boolean(props.transaction);
  const [state, formAction, pending] = useActionState(
    editing ? updateTransactionAction : createTransactionAction,
    initialState,
  );

  return (
    // After a successful create the action returns a fresh `submittedAt`,
    // which remounts the body and resets every field.
    <TransactionFormBody
      key={state.submittedAt ?? "initial"}
      {...props}
      editing={editing}
      formAction={formAction}
      pending={pending}
      error={state.error}
    />
  );
}

function TransactionFormBody({
  wallets,
  assets,
  defaultDate,
  transaction,
  editing,
  formAction,
  pending,
  error,
}: TransactionFormProps & {
  editing: boolean;
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
}) {
  const [txType, setTxType] = useState(transaction?.type ?? "BUY");
  const defaultAssetSelection =
    transaction?.assetId ?? (assets.length > 0 ? assets[0].id : NEW_ASSET);
  const [assetSelection, setAssetSelection] = useState(defaultAssetSelection);
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetSymbol, setNewAssetSymbol] = useState("");
  const [newAssetType, setNewAssetType] = useState("STOCK");
  const [newAssetQuoteCurrency, setNewAssetQuoteCurrency] = useState("EUR");
  const [newAssetExternalId, setNewAssetExternalId] = useState("");

  const isSell = txType === "SELL";
  const creatingAsset = !isSell && assetSelection === NEW_ASSET;
  const isCryptoAsset = newAssetType === "CRYPTO";

  function handleTypeChange(nextType: string) {
    setTxType(nextType);
    // A brand-new asset cannot be sold — fall back to an existing one.
    if (nextType === "SELL" && assetSelection === NEW_ASSET) {
      setAssetSelection(assets[0]?.id ?? "");
    }
  }

  function handleAssetSearchSelect(selection: AssetSearchSelection) {
    setNewAssetName(selection.name);
    setNewAssetSymbol(selection.symbol);
    setNewAssetType(selection.type);
    setNewAssetQuoteCurrency(selection.quoteCurrency);
    setNewAssetExternalId(
      selection.coingeckoId ?? selection.yahooSymbol ?? "",
    );
  }

  return (
    <form action={formAction} className={`${ui.card} flex flex-col gap-4`}>
      {transaction ? (
        <input type="hidden" name="id" value={transaction.id} />
      ) : null}
      <input type="hidden" name="type" value={txType} />
      <input
        type="hidden"
        name="assetMode"
        value={creatingAsset ? "new" : "existing"}
      />

      <div className="flex gap-2">
        {(["BUY", "SELL"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleTypeChange(option)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              txType === option
                ? "bg-emerald-600 text-white"
                : "border border-black/[.12] text-zinc-600 hover:bg-zinc-100 dark:border-white/[.16] dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            {option === "BUY" ? "Achat" : "Vente"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} flex-1`}>
          Wallet
          <select
            name="walletId"
            required
            defaultValue={transaction?.walletId ?? wallets[0]?.id ?? ""}
            className={ui.input}
          >
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name} ({wallet.currency})
              </option>
            ))}
          </select>
        </label>

        <label className={`${ui.label} flex-1`}>
          Asset
          <select
            name="assetId"
            value={assetSelection}
            onChange={(event) => setAssetSelection(event.target.value)}
            className={ui.input}
          >
            {assets.length === 0 && isSell ? (
              <option value="">Aucun asset disponible</option>
            ) : null}
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} ({asset.symbol})
              </option>
            ))}
            {!isSell ? (
              <option value={NEW_ASSET}>➕ Nouvel asset…</option>
            ) : null}
          </select>
        </label>
      </div>

      {creatingAsset ? (
        <fieldset className="flex flex-col gap-4 rounded-lg border border-dashed border-black/[.15] p-4 dark:border-white/[.15]">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Nouvel asset
          </legend>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Rechercher
            </span>
            <AssetSearch onSelect={handleAssetSearchSelect} />
            <span className="text-xs font-normal text-zinc-400">
              Tape un nom : les champs ci-dessous se remplissent
              automatiquement.
            </span>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <label className={`${ui.label} flex-1`}>
              Nom
              <input
                name="assetName"
                type="text"
                maxLength={80}
                required={creatingAsset}
                value={newAssetName}
                onChange={(event) => setNewAssetName(event.target.value)}
                placeholder="Ex. Apple, Bitcoin"
                className={ui.input}
              />
            </label>
            <label className={`${ui.label} sm:w-36`}>
              Symbole
              <input
                name="assetSymbol"
                type="text"
                maxLength={20}
                required={creatingAsset}
                value={newAssetSymbol}
                onChange={(event) => setNewAssetSymbol(event.target.value)}
                placeholder="AAPL, BTC"
                className={`${ui.input} uppercase`}
              />
            </label>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <label className={`${ui.label} flex-1`}>
              Type
              <select
                name="assetType"
                value={newAssetType}
                onChange={(event) => setNewAssetType(event.target.value)}
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
              Devise cotation
              <select
                name="assetQuoteCurrency"
                value={newAssetQuoteCurrency}
                onChange={(event) =>
                  setNewAssetQuoteCurrency(event.target.value)
                }
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
            {isCryptoAsset ? "Identifiant CoinGecko" : "Symbole Yahoo Finance"}
            <input
              name="assetExternalId"
              type="text"
              maxLength={120}
              value={newAssetExternalId}
              onChange={(event) => setNewAssetExternalId(event.target.value)}
              placeholder={isCryptoAsset ? "ex. bitcoin" : "ex. AAPL, CW8.PA"}
              className={ui.input}
            />
            <span className="text-xs font-normal text-zinc-400">
              Rempli automatiquement par la recherche — sert à récupérer le
              prix en direct.
            </span>
          </label>
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} flex-1`}>
          {isSell ? "Date de vente" : "Date d'achat"}
          <input
            name="executedAt"
            type="date"
            required
            defaultValue={transaction?.executedAt ?? defaultDate}
            className={ui.input}
          />
        </label>
        <label className={`${ui.label} flex-1`}>
          {isSell ? "Prix de vente unitaire" : "Prix d'achat unitaire"}
          <input
            name="unitPrice"
            type="number"
            step="any"
            min="0"
            required
            defaultValue={transaction?.unitPrice}
            placeholder="0.00"
            className={ui.input}
          />
        </label>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} flex-1`}>
          {isSell ? "Quantité vendue" : "Quantité reçue"}
          <input
            name="quantity"
            type="number"
            step="any"
            min="0"
            required
            defaultValue={transaction?.quantity}
            placeholder="0"
            className={ui.input}
          />
        </label>
        <label className={`${ui.label} flex-1`}>
          {isSell ? "Montant reçu" : "Montant investi"}
          <input
            name="amountInvested"
            type="number"
            step="any"
            min="0"
            required
            defaultValue={transaction?.amountInvested}
            placeholder="0.00"
            className={ui.input}
          />
          <span className="text-xs font-normal text-zinc-400">
            {isSell
              ? "Total reçu pour cette vente, dans la devise du wallet (hors frais)."
              : "Montant investi dans l'asset, dans la devise du wallet (hors frais)."}
          </span>
        </label>
        <label className={`${ui.label} sm:w-36`}>
          Frais
          <input
            name="fees"
            type="number"
            step="any"
            min="0"
            defaultValue={transaction?.fees ?? 0}
            placeholder="0.00"
            className={ui.input}
          />
        </label>
      </div>

      <label className={ui.label}>
        Note (optionnel)
        <textarea
          name="notes"
          maxLength={280}
          rows={2}
          defaultValue={transaction?.notes ?? ""}
          className={ui.input}
        />
      </label>

      {error ? <p className={ui.errorText}>{error}</p> : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={ui.primaryButton}>
          {pending
            ? "Enregistrement…"
            : editing
              ? "Enregistrer"
              : isSell
                ? "Ajouter la vente"
                : "Ajouter l'achat"}
        </button>
      </div>
    </form>
  );
}

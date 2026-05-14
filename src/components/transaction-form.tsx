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
  const defaultAssetSelection =
    transaction?.assetId ?? (assets.length > 0 ? assets[0].id : NEW_ASSET);
  const [assetSelection, setAssetSelection] = useState(defaultAssetSelection);
  const [newAssetType, setNewAssetType] = useState("STOCK");

  const creatingAsset = assetSelection === NEW_ASSET;
  const isCryptoAsset = newAssetType === "CRYPTO";

  return (
    <form action={formAction} className={`${ui.card} flex flex-col gap-4`}>
      {transaction ? (
        <input type="hidden" name="id" value={transaction.id} />
      ) : null}
      <input
        type="hidden"
        name="assetMode"
        value={creatingAsset ? "new" : "existing"}
      />

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
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} ({asset.symbol})
              </option>
            ))}
            <option value={NEW_ASSET}>➕ Nouvel asset…</option>
          </select>
        </label>
      </div>

      {creatingAsset ? (
        <fieldset className="flex flex-col gap-4 rounded-lg border border-dashed border-black/[.15] p-4 dark:border-white/[.15]">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Nouvel asset
          </legend>
          <div className="flex flex-col gap-4 sm:flex-row">
            <label className={`${ui.label} flex-1`}>
              Nom
              <input
                name="assetName"
                type="text"
                maxLength={80}
                required={creatingAsset}
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
                defaultValue="EUR"
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
              placeholder={isCryptoAsset ? "ex. bitcoin" : "ex. AAPL, CW8.PA"}
              className={ui.input}
            />
            <span className="text-xs font-normal text-zinc-400">
              Permet de récupérer le prix en direct. Modifiable ensuite dans la
              page Assets.
            </span>
          </label>
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} flex-1`}>
          Date d&apos;achat
          <input
            name="executedAt"
            type="date"
            required
            defaultValue={transaction?.executedAt ?? defaultDate}
            className={ui.input}
          />
        </label>
        <label className={`${ui.label} flex-1`}>
          Prix d&apos;achat unitaire
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
          Quantité reçue
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
          Montant investi
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
            Total réellement déboursé, dans la devise du wallet.
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
              : "Ajouter la transaction"}
        </button>
      </div>
    </form>
  );
}

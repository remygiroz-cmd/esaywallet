"use client";

import { useActionState } from "react";
import {
  updateWalletAction,
  type WalletFormState,
} from "@/app/(app)/wallets/actions";
import {
  WALLET_TYPES,
  WALLET_TYPE_LABELS,
  SUPPORTED_CURRENCIES,
  taxRateForWalletType,
} from "@/lib/constants";
import { ui } from "@/lib/ui";

const initialState: WalletFormState = {};

type WalletEditFormProps = {
  wallet: {
    id: string;
    name: string;
    type: string;
    currency: string;
    taxRate: number | null;
  };
};

export function WalletEditForm({ wallet }: WalletEditFormProps) {
  const [state, formAction, pending] = useActionState(
    updateWalletAction,
    initialState,
  );

  const defaultRatePercent = (
    taxRateForWalletType(wallet.type) * 100
  ).toLocaleString("fr-FR");

  return (
    <form action={formAction} className={`${ui.card} flex flex-col gap-4`}>
      <input type="hidden" name="id" value={wallet.id} />

      <label className={ui.label}>
        Nom du wallet
        <input
          name="name"
          type="text"
          required
          maxLength={60}
          defaultValue={wallet.name}
          className={ui.input}
        />
      </label>

      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} flex-1`}>
          Type
          <select
            name="type"
            defaultValue={wallet.type}
            className={ui.input}
          >
            {WALLET_TYPES.map((type) => (
              <option key={type} value={type}>
                {WALLET_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label className={`${ui.label} w-28`}>
          Devise
          <select
            name="currency"
            defaultValue={wallet.currency}
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
        Taux d&apos;imposition des plus-values (%)
        <input
          name="taxRate"
          type="number"
          step="any"
          min="0"
          max="100"
          defaultValue={wallet.taxRate != null ? wallet.taxRate * 100 : ""}
          placeholder={`Par défaut : ${defaultRatePercent} %`}
          className={ui.input}
        />
        <span className="text-xs font-normal text-zinc-400">
          Laissez vide pour utiliser le taux par défaut du type de wallet.
          Utile par exemple pour un PEA de moins de 5 ans.
        </span>
      </label>

      {state.error ? <p className={ui.errorText}>{state.error}</p> : null}
      {state.ok ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Modifications enregistrées.
        </p>
      ) : null}

      <div>
        <button type="submit" disabled={pending} className={ui.primaryButton}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

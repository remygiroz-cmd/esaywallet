"use client";

import { useActionState } from "react";
import {
  createWalletAction,
  type WalletFormState,
} from "@/app/(app)/wallets/actions";
import {
  WALLET_TYPES,
  WALLET_TYPE_LABELS,
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
} from "@/lib/constants";
import { ui } from "@/lib/ui";

const initialState: WalletFormState = {};

export function WalletCreateForm() {
  const [state, formAction, pending] = useActionState(
    createWalletAction,
    initialState,
  );

  return (
    // Remount the form after each successful create so the fields reset.
    <form
      key={state.submittedAt ?? "initial"}
      action={formAction}
      className={`${ui.card} flex flex-col gap-4 sm:flex-row sm:items-end`}
    >
      <label className={`${ui.label} flex-1`}>
        Nom du wallet
        <input
          name="name"
          type="text"
          required
          maxLength={60}
          placeholder="Ex. PEA Bourse Direct"
          className={ui.input}
        />
      </label>

      <label className={`${ui.label} sm:w-48`}>
        Type
        <select name="type" defaultValue="CTO" className={ui.input}>
          {WALLET_TYPES.map((type) => (
            <option key={type} value={type}>
              {WALLET_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      <label className={`${ui.label} sm:w-28`}>
        Devise
        <select
          name="currency"
          defaultValue={DEFAULT_CURRENCY}
          className={ui.input}
        >
          {SUPPORTED_CURRENCIES.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </label>

      <label className={`${ui.label} sm:w-44`}>
        Date d&apos;ouverture
        <input name="openedAt" type="date" className={ui.input} />
      </label>

      <label className={`${ui.label} sm:w-40`}>
        Solde manuel
        <input
          name="manualLiquidity"
          type="number"
          step="any"
          min="0"
          placeholder="0.00"
          className={ui.input}
        />
      </label>

      <button type="submit" disabled={pending} className={ui.primaryButton}>
        {pending ? "Création…" : "Ajouter"}
      </button>

      {state.error ? (
        <p className={`${ui.errorText} sm:basis-full`}>{state.error}</p>
      ) : null}
    </form>
  );
}

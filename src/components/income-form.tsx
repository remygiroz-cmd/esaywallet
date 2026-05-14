"use client";

import { useActionState } from "react";
import {
  createIncomeAction,
  type IncomeFormState,
} from "@/app/(app)/revenus/actions";
import { INCOME_KINDS, INCOME_KIND_LABELS } from "@/lib/constants";
import { ui } from "@/lib/ui";

type WalletOption = { id: string; name: string; currency: string };
type AssetOption = { id: string; name: string; symbol: string };

const initialState: IncomeFormState = {};

export function IncomeForm({
  wallets,
  assets,
  defaultDate,
}: {
  wallets: WalletOption[];
  assets: AssetOption[];
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState(
    createIncomeAction,
    initialState,
  );

  return (
    // Remount on each successful create so the fields reset.
    <form
      key={state.submittedAt ?? "initial"}
      action={formAction}
      className={`${ui.card} flex flex-col gap-4`}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} flex-1`}>
          Wallet
          <select
            name="walletId"
            required
            defaultValue={wallets[0]?.id ?? ""}
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
            required
            defaultValue={assets[0]?.id ?? ""}
            className={ui.input}
          >
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} ({asset.symbol})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} flex-1`}>
          Type de revenu
          <select name="kind" defaultValue="DIVIDEND" className={ui.input}>
            {INCOME_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {INCOME_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
        <label className={`${ui.label} flex-1`}>
          Date de versement
          <input
            name="receivedAt"
            type="date"
            required
            defaultValue={defaultDate}
            className={ui.input}
          />
        </label>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} flex-1`}>
          Montant reçu
          <input
            name="amount"
            type="number"
            step="any"
            min="0"
            required
            placeholder="0.00"
            className={ui.input}
          />
          <span className="text-xs font-normal text-zinc-400">
            Montant brut, dans la devise du wallet.
          </span>
        </label>
        <label className={`${ui.label} sm:w-36`}>
          Frais / prélèvements
          <input
            name="fees"
            type="number"
            step="any"
            min="0"
            defaultValue={0}
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
          className={ui.input}
        />
      </label>

      {state.error ? <p className={ui.errorText}>{state.error}</p> : null}

      <div>
        <button type="submit" disabled={pending} className={ui.primaryButton}>
          {pending ? "Enregistrement…" : "Ajouter le revenu"}
        </button>
      </div>
    </form>
  );
}

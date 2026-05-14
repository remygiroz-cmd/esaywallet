"use client";

import { useActionState } from "react";
import {
  createCashMovementAction,
  type CashMovementFormState,
} from "@/app/(app)/wallets/actions";
import {
  CASH_MOVEMENT_KINDS,
  CASH_MOVEMENT_KIND_LABELS,
} from "@/lib/constants";
import { ui } from "@/lib/ui";

const initialState: CashMovementFormState = {};

export function CashMovementForm({
  walletId,
  currency,
  defaultDate,
}: {
  walletId: string;
  currency: string;
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState(
    createCashMovementAction,
    initialState,
  );

  return (
    <form
      key={state.submittedAt ?? "initial"}
      action={formAction}
      className={`${ui.card} flex flex-col gap-4`}
    >
      <input type="hidden" name="walletId" value={walletId} />
      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} sm:w-44`}>
          Type
          <select name="kind" defaultValue="DEPOSIT" className={ui.input}>
            {CASH_MOVEMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {CASH_MOVEMENT_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
        <label className={`${ui.label} flex-1`}>
          Montant ({currency})
          <input
            name="amount"
            type="number"
            step="any"
            min="0"
            required
            placeholder="0.00"
            className={ui.input}
          />
        </label>
        <label className={`${ui.label} sm:w-48`}>
          Date
          <input
            name="occurredAt"
            type="date"
            required
            defaultValue={defaultDate}
            className={ui.input}
          />
        </label>
      </div>

      <label className={ui.label}>
        Note (optionnel)
        <input
          name="note"
          maxLength={140}
          placeholder="Ex. : virement mensuel"
          className={ui.input}
        />
      </label>

      {state.error ? <p className={ui.errorText}>{state.error}</p> : null}

      <div>
        <button type="submit" disabled={pending} className={ui.primaryButton}>
          {pending ? "Enregistrement…" : "Enregistrer le mouvement"}
        </button>
      </div>
    </form>
  );
}

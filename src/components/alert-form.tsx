"use client";

import { useActionState, useState } from "react";
import {
  createAlertAction,
  type AlertFormState,
} from "@/app/(app)/alertes/actions";
import { ALERT_DIRECTIONS, ALERT_DIRECTION_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { ui } from "@/lib/ui";

export type AssetOption = {
  id: string;
  name: string;
  symbol: string;
  quoteCurrency: string;
  currentPrice: number | null;
};

const initialState: AlertFormState = {};

export function AlertForm({ assets }: { assets: AssetOption[] }) {
  const [state, formAction, pending] = useActionState(
    createAlertAction,
    initialState,
  );
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");

  const selected = assets.find((asset) => asset.id === assetId);

  return (
    <form
      key={state.submittedAt ?? "initial"}
      action={formAction}
      className={`${ui.card} flex flex-col gap-4`}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} flex-1`}>
          Asset
          <select
            name="assetId"
            required
            value={assetId}
            onChange={(event) => setAssetId(event.target.value)}
            className={ui.input}
          >
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name} ({asset.symbol})
              </option>
            ))}
          </select>
          {selected ? (
            <span className="text-xs font-normal text-zinc-400">
              Cours actuel :{" "}
              {selected.currentPrice !== null
                ? formatCurrency(
                    selected.currentPrice,
                    selected.quoteCurrency,
                  )
                : "indisponible"}
            </span>
          ) : null}
        </label>
        <label className={`${ui.label} sm:w-48`}>
          Condition
          <select name="direction" defaultValue="ABOVE" className={ui.input}>
            {ALERT_DIRECTIONS.map((direction) => (
              <option key={direction} value={direction}>
                {ALERT_DIRECTION_LABELS[direction]}
              </option>
            ))}
          </select>
        </label>
        <label className={`${ui.label} sm:w-40`}>
          Seuil ({selected?.quoteCurrency ?? "—"})
          <input
            name="threshold"
            type="number"
            step="any"
            min="0"
            required
            placeholder="0.00"
            className={ui.input}
          />
        </label>
      </div>

      <label className={ui.label}>
        Note (optionnel)
        <input
          name="note"
          maxLength={140}
          placeholder="Ex. : revendre une partie"
          className={ui.input}
        />
      </label>

      {state.error ? <p className={ui.errorText}>{state.error}</p> : null}

      <div>
        <button type="submit" disabled={pending} className={ui.primaryButton}>
          {pending ? "Enregistrement…" : "Créer l'alerte"}
        </button>
      </div>
    </form>
  );
}

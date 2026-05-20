"use client";

import { useActionState, useState } from "react";
import {
  createDividendAction,
  type DividendFormState,
} from "@/app/(app)/dividendes/actions";
import { SUPPORTED_CURRENCIES } from "@/lib/constants";
import { ui } from "@/lib/ui";

type WalletOption = { id: string; name: string; currency: string };
type AssetOption = { id: string; name: string; symbol: string };

const initialState: DividendFormState = {};

export function DividendForm({
  wallets,
  assets,
  defaultDate,
}: {
  wallets: WalletOption[];
  assets: AssetOption[];
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState(
    createDividendAction,
    initialState,
  );

  // The wallet drives the default currency, so we track it locally to
  // pre-fill the currency selector when the user picks a wallet.
  const [walletId, setWalletId] = useState<string>(wallets[0]?.id ?? "");
  const walletCurrency =
    wallets.find((wallet) => wallet.id === walletId)?.currency ?? "EUR";

  return (
    <form
      key={state.submittedAt ?? "initial"}
      action={formAction}
      className={`${ui.card} flex flex-col gap-4`}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} flex-1`}>
          Source (entreprise, courtier, ETF…)
          <input
            name="source"
            type="text"
            required
            maxLength={120}
            placeholder="Ex. Apple Inc., Boursorama IFU, World ETF"
            className={ui.input}
          />
        </label>
        <label className={`${ui.label} sm:w-56`}>
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
          Wallet d&apos;origine (optionnel)
          <select
            name="walletId"
            value={walletId}
            onChange={(event) => setWalletId(event.target.value)}
            className={ui.input}
          >
            <option value="">— Aucun (déclaration libre) —</option>
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name} ({wallet.currency})
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-zinc-400">
            Sert uniquement au calcul du taux d&apos;imposition. Le cash du
            wallet n&apos;est pas modifié.
          </span>
        </label>
        <label className={`${ui.label} flex-1`}>
          Asset (optionnel)
          <select name="assetId" defaultValue="" className={ui.input}>
            <option value="">— Non lié à un asset —</option>
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
          Montant brut
          <input
            name="grossAmount"
            type="number"
            step="any"
            min="0"
            required
            placeholder="0.00"
            className={ui.input}
          />
        </label>
        <label className={`${ui.label} flex-1`}>
          Impôt déjà prélevé à la source
          <input
            name="withheldTax"
            type="number"
            step="any"
            min="0"
            defaultValue={0}
            placeholder="0.00"
            className={ui.input}
          />
        </label>
        <label className={`${ui.label} sm:w-32`}>
          Devise
          <select
            name="currency"
            defaultValue={walletCurrency}
            key={walletCurrency}
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

      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} sm:w-56`}>
          Taux d&apos;imposition (optionnel)
          <input
            name="taxRate"
            type="number"
            step="any"
            min="0"
            max="1"
            placeholder="0.30"
            className={ui.input}
          />
          <span className="text-xs font-normal text-zinc-400">
            Ratio (ex. 0.30 = 30 %). Si vide, déduit du wallet ou 30 % par
            défaut.
          </span>
        </label>
        <label className={`${ui.label} flex-1`}>
          Note (optionnel)
          <textarea
            name="notes"
            maxLength={280}
            rows={2}
            className={ui.input}
          />
        </label>
      </div>

      {state.error ? <p className={ui.errorText}>{state.error}</p> : null}

      <div>
        <button type="submit" disabled={pending} className={ui.primaryButton}>
          {pending ? "Enregistrement…" : "Ajouter le dividende"}
        </button>
      </div>
    </form>
  );
}

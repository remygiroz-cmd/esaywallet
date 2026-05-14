import { requireUser } from "@/lib/auth-server";
import { getUserWallets } from "@/lib/wallets";
import { getUserAssets } from "@/lib/assets";
import { getUserIncome } from "@/lib/income";
import { INCOME_KIND_LABELS, type IncomeKind } from "@/lib/constants";
import { ui } from "@/lib/ui";
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format";
import { IncomeForm } from "@/components/income-form";
import { DeleteButton } from "@/components/delete-button";
import { deleteIncomeAction } from "./actions";

export default async function RevenusPage() {
  const user = await requireUser();
  const [wallets, assets, income] = await Promise.all([
    getUserWallets(user.id),
    getUserAssets(user.id),
    getUserIncome(user.id),
  ]);

  const totalsByCurrency = new Map<string, number>();
  for (const entry of income) {
    const net = entry.amount.toNumber() - entry.fees.toNumber();
    totalsByCurrency.set(
      entry.wallet.currency,
      (totalsByCurrency.get(entry.wallet.currency) ?? 0) + net,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className={ui.heading}>Revenus</h1>
        <p className={`mt-1 ${ui.subtle}`}>
          Dividendes, coupons, récompenses de staking et intérêts perçus sur
          vos placements.
        </p>
      </header>

      {income.length > 0 ? (
        <div className={`${ui.card} flex flex-wrap gap-x-10 gap-y-2`}>
          {[...totalsByCurrency.entries()].map(([currency, total]) => (
            <div key={currency}>
              <p className="text-xl font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                {formatCurrency(total, currency)}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Revenus perçus ({currency})
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {wallets.length === 0 || assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Créez d&apos;abord un wallet et un asset pour enregistrer des
          revenus.
        </div>
      ) : (
        <IncomeForm
          wallets={wallets.map((w) => ({
            id: w.id,
            name: w.name,
            currency: w.currency,
          }))}
          assets={assets.map((a) => ({
            id: a.id,
            name: a.name,
            symbol: a.symbol,
          }))}
          defaultDate={toDateInputValue(new Date())}
        />
      )}

      {income.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Aucun revenu enregistré.
        </div>
      ) : (
        <div className={`${ui.card} overflow-x-auto p-0`}>
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 text-right font-medium">
                  Montant net
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {income.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                    {formatDate(entry.receivedAt)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {INCOME_KIND_LABELS[entry.kind as IncomeKind] ??
                      entry.kind}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-black dark:text-zinc-50">
                      {entry.asset.name}
                    </span>{" "}
                    <span className="font-mono text-xs text-zinc-400">
                      {entry.asset.symbol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {entry.wallet.name}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(
                      entry.amount.toNumber() - entry.fees.toNumber(),
                      entry.wallet.currency,
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteButton
                      action={deleteIncomeAction}
                      id={entry.id}
                      label="Suppr."
                      confirmMessage="Supprimer ce revenu ?"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-zinc-400">
        Astuce : les revenus apparaissent dans la synthèse du tableau de bord
        et dans la page Fiscalité (les dividendes sont imposables).
      </p>
    </div>
  );
}

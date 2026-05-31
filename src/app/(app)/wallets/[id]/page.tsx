import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth-server";
import { getWallet } from "@/lib/wallets";
import { getWalletTransactions } from "@/lib/transactions";
import { getWalletCashMovements, getCashByWallet } from "@/lib/cash";
import {
  WALLET_TYPE_LABELS,
  type WalletType,
  CASH_MOVEMENT_KIND_LABELS,
  type CashMovementKind,
  walletTracksCash,
} from "@/lib/constants";
import { ui } from "@/lib/ui";
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/format";
import { WalletEditForm } from "@/components/wallet-edit-form";
import { CashMovementForm } from "@/components/cash-movement-form";
import {
  TransactionTable,
  type TransactionRow,
} from "@/components/transaction-table";
import { DeleteButton } from "@/components/delete-button";
import { deleteWalletAction, deleteCashMovementAction } from "../actions";

export default async function WalletDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireProfile();
  const wallet = await getWallet(id, profile.id);

  if (!wallet) notFound();

  const [transactions, cashMovements, cashByWallet] = await Promise.all([
    getWalletTransactions(wallet.id, profile.id),
    getWalletCashMovements(wallet.id, profile.id),
    getCashByWallet(profile.id),
  ]);
  const movementsCash = cashByWallet.get(wallet.id) ?? 0;
  const manualDeposits =
    wallet.manualDeposits !== null ? wallet.manualDeposits.toNumber() : null;
  const manualCash =
    wallet.manualCash !== null ? wallet.manualCash.toNumber() : null;
  // A manual override replaces the movements-derived cash when set.
  const cashBalance = manualCash !== null ? manualCash : movementsCash;
  const tracksCash = walletTracksCash(wallet.type);
  const walletForForm = {
    id: wallet.id,
    name: wallet.name,
    type: wallet.type,
    currency: wallet.currency,
    taxRate: wallet.taxRate,
    openedAt: wallet.openedAt,
    manualDeposits,
    manualCash,
  };

  const rows: TransactionRow[] = transactions.map((tx) => ({
    id: tx.id,
    executedAt: tx.executedAt.toISOString(),
    type: tx.type,
    assetName: tx.asset.name,
    assetSymbol: tx.asset.symbol,
    walletName: tx.wallet.name,
    quantity: tx.quantity.toNumber(),
    unitPrice: tx.unitPrice.toNumber(),
    quoteCurrency: tx.asset.quoteCurrency,
    amountInvested: tx.amountInvested.toNumber(),
    walletCurrency: tx.wallet.currency,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/wallets"
          className="text-sm text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
        >
          ← Tous les wallets
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className={ui.heading}>{wallet.name}</h1>
            <p className={`mt-1 ${ui.subtle}`}>
              {WALLET_TYPE_LABELS[wallet.type as WalletType] ?? wallet.type} ·{" "}
              {wallet.currency}
            </p>
          </div>
          <DeleteButton
            action={deleteWalletAction}
            id={wallet.id}
            label="Supprimer le wallet"
            confirmMessage={`Supprimer le wallet « ${wallet.name} » ? Toutes ses transactions seront aussi supprimées.`}
          />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Paramètres
        </h2>
        <WalletEditForm wallet={walletForForm} />
      </section>

      {tracksCash ? (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Espèces
        </h2>
        <div className={`${ui.card} flex flex-wrap items-end gap-x-10 gap-y-2`}>
          <div>
            <p
              className={`text-2xl font-semibold tabular-nums ${
                cashBalance < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-black dark:text-zinc-50"
              }`}
            >
              {formatCurrency(cashBalance, wallet.currency)}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Solde de liquidités
            </p>
          </div>
          {manualCash !== null ? (
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              <p>
                Solde saisi manuellement :{" "}
                <span className="tabular-nums">
                  {formatCurrency(manualCash, wallet.currency)}
                </span>
              </p>
              <p>
                Calcul des mouvements :{" "}
                <span className="tabular-nums">
                  {formatCurrency(movementsCash, wallet.currency)}
                </span>
              </p>
            </div>
          ) : null}
          <p className="text-xs text-zinc-400">
            {manualCash !== null
              ? "Solde saisi dans les paramètres du wallet, qui remplace le calcul automatique. Inclus dans le total du wallet."
              : "Dépôts − retraits − achats + ventes + revenus. Renseignez un solde manuel dans les paramètres pour le remplacer. Inclus dans le total du wallet."}
          </p>
        </div>

        <CashMovementForm
          walletId={wallet.id}
          currency={wallet.currency}
          defaultDate={toDateInputValue(new Date())}
        />

        {cashMovements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-6 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
            Aucun dépôt ni retrait enregistré.
          </div>
        ) : (
          <div className={`${ui.card} overflow-x-auto p-0`}>
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                  <th className="px-4 py-3 text-right font-medium">Montant</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {cashMovements.map((movement) => {
                  const amount = movement.amount.toNumber();
                  const isDeposit = movement.kind === "DEPOSIT";
                  return (
                    <tr
                      key={movement.id}
                      className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                        {formatDate(movement.occurredAt)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {CASH_MOVEMENT_KIND_LABELS[
                          movement.kind as CashMovementKind
                        ] ?? movement.kind}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                        {movement.note ?? "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium tabular-nums ${
                          isDeposit
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {isDeposit ? "+" : "−"}
                        {formatCurrency(amount, wallet.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <form action={deleteCashMovementAction}>
                          <input
                            type="hidden"
                            name="id"
                            value={movement.id}
                          />
                          <input
                            type="hidden"
                            name="walletId"
                            value={wallet.id}
                          />
                          <button
                            type="submit"
                            className={ui.dangerButton}
                          >
                            Suppr.
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Transactions ({rows.length})
          </h2>
          <Link
            href="/transactions"
            className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            + Ajouter une transaction
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
            Aucune transaction dans ce wallet.
          </div>
        ) : (
          <TransactionTable rows={rows} showWallet={false} />
        )}
      </section>
    </div>
  );
}

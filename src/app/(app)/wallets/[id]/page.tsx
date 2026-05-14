import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-server";
import { getWallet } from "@/lib/wallets";
import { getWalletTransactions } from "@/lib/transactions";
import { WALLET_TYPE_LABELS, type WalletType } from "@/lib/constants";
import { ui } from "@/lib/ui";
import { formatCurrency, formatQuantity, formatDate } from "@/lib/format";
import { WalletEditForm } from "@/components/wallet-edit-form";
import { TransactionTypeBadge } from "@/components/transaction-type-badge";
import { DeleteButton } from "@/components/delete-button";
import { deleteWalletAction } from "../actions";
import { deleteTransactionAction } from "@/app/(app)/transactions/actions";

export default async function WalletDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const wallet = await getWallet(id, user.id);

  if (!wallet) notFound();

  const transactions = await getWalletTransactions(wallet.id, user.id);

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
        <WalletEditForm wallet={wallet} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Transactions ({transactions.length})
          </h2>
          <Link
            href="/transactions"
            className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            + Ajouter une transaction
          </Link>
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
            Aucune transaction dans ce wallet.
          </div>
        ) : (
          <div className={`${ui.card} overflow-x-auto p-0`}>
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Asset</th>
                  <th className="px-4 py-3 text-right font-medium">Quantité</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Prix unitaire
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Montant</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                      {formatDate(tx.executedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <TransactionTypeBadge type={tx.type} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-black dark:text-zinc-50">
                        {tx.asset.name}
                      </span>{" "}
                      <span className="font-mono text-xs text-zinc-400">
                        {tx.asset.symbol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                      {formatQuantity(tx.quantity.toNumber())}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                      {formatCurrency(
                        tx.unitPrice.toNumber(),
                        tx.asset.quoteCurrency,
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-black dark:text-zinc-50">
                      {formatCurrency(
                        tx.amountInvested.toNumber(),
                        tx.wallet.currency,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/transactions/${tx.id}`}
                          className="text-xs text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                          Modifier
                        </Link>
                        <DeleteButton
                          action={deleteTransactionAction}
                          id={tx.id}
                          label="Suppr."
                          confirmMessage="Supprimer cette transaction ?"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

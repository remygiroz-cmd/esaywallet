import Link from "next/link";
import { requireUser } from "@/lib/auth-server";
import { getUserWallets } from "@/lib/wallets";
import { getUserAssets } from "@/lib/assets";
import { getUserTransactions } from "@/lib/transactions";
import { ui } from "@/lib/ui";
import {
  formatCurrency,
  formatQuantity,
  formatDate,
  toDateInputValue,
} from "@/lib/format";
import { TransactionForm } from "@/components/transaction-form";
import { DeleteButton } from "@/components/delete-button";
import { deleteTransactionAction } from "./actions";

export default async function TransactionsPage() {
  const user = await requireUser();
  const [wallets, assets, transactions] = await Promise.all([
    getUserWallets(user.id),
    getUserAssets(user.id),
    getUserTransactions(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className={ui.heading}>Transactions</h1>
        <p className={`mt-1 ${ui.subtle}`}>
          Enregistrez chaque achat : asset, date, prix, montant investi et
          quantité reçue.
        </p>
      </header>

      {wallets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Créez d&apos;abord un wallet sur la page{" "}
          <Link
            href="/wallets"
            className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Wallets
          </Link>{" "}
          pour pouvoir enregistrer des transactions.
        </div>
      ) : (
        <TransactionForm
          wallets={wallets.map((w) => ({
            id: w.id,
            name: w.name,
            currency: w.currency,
          }))}
          assets={assets.map((a) => ({
            id: a.id,
            name: a.name,
            symbol: a.symbol,
            quoteCurrency: a.quoteCurrency,
          }))}
          defaultDate={toDateInputValue(new Date())}
        />
      )}

      {transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Aucune transaction enregistrée.
        </div>
      ) : (
        <div className={`${ui.card} overflow-x-auto p-0`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 text-right font-medium">Quantité</th>
                <th className="px-4 py-3 text-right font-medium">
                  Prix unitaire
                </th>
                <th className="px-4 py-3 text-right font-medium">Investi</th>
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
                    <span className="font-medium text-black dark:text-zinc-50">
                      {tx.asset.name}
                    </span>{" "}
                    <span className="font-mono text-xs text-zinc-400">
                      {tx.asset.symbol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {tx.wallet.name}
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
    </div>
  );
}

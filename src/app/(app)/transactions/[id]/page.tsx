import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-server";
import { getUserWallets } from "@/lib/wallets";
import { getUserAssets } from "@/lib/assets";
import { getTransaction } from "@/lib/transactions";
import { ui } from "@/lib/ui";
import { toDateInputValue } from "@/lib/format";
import { TransactionForm } from "@/components/transaction-form";
import { DeleteButton } from "@/components/delete-button";
import { deleteTransactionAction } from "../actions";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [transaction, wallets, assets] = await Promise.all([
    getTransaction(id, user.id),
    getUserWallets(user.id),
    getUserAssets(user.id),
  ]);

  if (!transaction) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/transactions"
          className="text-sm text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
        >
          ← Toutes les transactions
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className={ui.heading}>Modifier la transaction</h1>
            <p className={`mt-1 ${ui.subtle}`}>
              {transaction.asset.name} · {transaction.wallet.name}
            </p>
          </div>
          <DeleteButton
            action={deleteTransactionAction}
            id={transaction.id}
            label="Supprimer"
            confirmMessage="Supprimer cette transaction ?"
          />
        </div>
      </div>

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
        transaction={{
          id: transaction.id,
          walletId: transaction.walletId,
          assetId: transaction.assetId,
          type: transaction.type,
          executedAt: toDateInputValue(transaction.executedAt),
          unitPrice: transaction.unitPrice.toNumber(),
          quantity: transaction.quantity.toNumber(),
          amountInvested: transaction.amountInvested.toNumber(),
          fees: transaction.fees.toNumber(),
          notes: transaction.notes,
        }}
      />
    </div>
  );
}

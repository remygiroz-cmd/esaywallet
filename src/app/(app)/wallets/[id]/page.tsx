import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-server";
import { getWallet } from "@/lib/wallets";
import { getWalletTransactions } from "@/lib/transactions";
import { WALLET_TYPE_LABELS, type WalletType } from "@/lib/constants";
import { ui } from "@/lib/ui";
import { WalletEditForm } from "@/components/wallet-edit-form";
import {
  TransactionTable,
  type TransactionRow,
} from "@/components/transaction-table";
import { DeleteButton } from "@/components/delete-button";
import { deleteWalletAction } from "../actions";

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
        <WalletEditForm wallet={wallet} />
      </section>

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

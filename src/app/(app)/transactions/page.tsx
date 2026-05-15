import Link from "next/link";
import { requireProfile } from "@/lib/auth-server";
import { getProfileWallets } from "@/lib/wallets";
import { getProfileAssets } from "@/lib/assets";
import { getProfileTransactions } from "@/lib/transactions";
import { ui } from "@/lib/ui";
import { toDateInputValue } from "@/lib/format";
import { TransactionForm } from "@/components/transaction-form";
import {
  TransactionTable,
  type TransactionRow,
} from "@/components/transaction-table";

export default async function TransactionsPage() {
  const { profile } = await requireProfile();
  const [wallets, assets, transactions] = await Promise.all([
    getProfileWallets(profile.id),
    getProfileAssets(profile.id),
    getProfileTransactions(profile.id),
  ]);

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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={ui.heading}>Transactions</h1>
          <p className={`mt-1 ${ui.subtle}`}>
            Enregistrez chaque achat : asset, date, prix, montant investi et
            quantité reçue.
          </p>
        </div>
        <Link href="/transactions/import" className={ui.secondaryButton}>
          Import en masse
        </Link>
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

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Aucune transaction enregistrée.
        </div>
      ) : (
        <TransactionTable rows={rows} showWallet />
      )}
    </div>
  );
}

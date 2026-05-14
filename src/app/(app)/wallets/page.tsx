import Link from "next/link";
import { requireUser } from "@/lib/auth-server";
import { getUserWallets } from "@/lib/wallets";
import { WALLET_TYPE_LABELS, type WalletType } from "@/lib/constants";
import { ui } from "@/lib/ui";
import { WalletCreateForm } from "@/components/wallet-create-form";
import { DeleteButton } from "@/components/delete-button";
import { deleteWalletAction } from "./actions";

export default async function WalletsPage() {
  const user = await requireUser();
  const wallets = await getUserWallets(user.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className={ui.heading}>Wallets</h1>
        <p className={`mt-1 ${ui.subtle}`}>
          Répartissez vos investissements en portefeuilles (CTO, PEA,
          crypto…).
        </p>
      </header>

      <WalletCreateForm />

      {wallets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Aucun wallet pour l&apos;instant. Créez-en un ci-dessus pour
          commencer.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {wallets.map((wallet) => (
            <li key={wallet.id} className={`${ui.card} flex flex-col gap-3`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/wallets/${wallet.id}`}
                    className="font-semibold text-black hover:text-emerald-600 dark:text-zinc-50 dark:hover:text-emerald-400"
                  >
                    {wallet.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {WALLET_TYPE_LABELS[wallet.type as WalletType] ??
                      wallet.type}
                  </p>
                </div>
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {wallet.currency}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {wallet._count.transactions} transaction
                  {wallet._count.transactions === 1 ? "" : "s"}
                </span>
                <DeleteButton
                  action={deleteWalletAction}
                  id={wallet.id}
                  confirmMessage={`Supprimer le wallet « ${wallet.name} » ? Toutes ses transactions seront aussi supprimées.`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

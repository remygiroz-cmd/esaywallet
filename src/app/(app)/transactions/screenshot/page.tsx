import Link from "next/link";
import { requireProfile } from "@/lib/auth-server";
import { getProfileWallets } from "@/lib/wallets";
import { getProfileAssets } from "@/lib/assets";
import { ui } from "@/lib/ui";
import { ScreenshotImport } from "@/components/screenshot-import";

export default async function TransactionScreenshotPage() {
  const { profile } = await requireProfile();
  const [wallets, assets] = await Promise.all([
    getProfileWallets(profile.id),
    getProfileAssets(profile.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/transactions"
          className="text-sm text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
        >
          ← Toutes les transactions
        </Link>
        <h1 className={`mt-2 ${ui.heading}`}>Import par capture d&apos;écran</h1>
        <p className={`mt-1 ${ui.subtle}`}>
          Dépose une capture d&apos;écran d&apos;une confirmation d&apos;achat
          ou de vente : l&apos;assistant lit les champs (date, asset, quantité,
          prix, montant), tu vérifies, et la transaction est enregistrée.
        </p>
      </div>

      {wallets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Crée d&apos;abord un wallet sur la page{" "}
          <Link
            href="/wallets"
            className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Wallets
          </Link>{" "}
          pour pouvoir enregistrer une transaction.
        </div>
      ) : (
        <ScreenshotImport
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
        />
      )}
    </div>
  );
}

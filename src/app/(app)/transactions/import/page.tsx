import Link from "next/link";
import { requireUser } from "@/lib/auth-server";
import { getUserWallets } from "@/lib/wallets";
import { getUserAssets } from "@/lib/assets";
import { ui } from "@/lib/ui";
import { TransactionImport } from "@/components/transaction-import";

export default async function TransactionImportPage() {
  const user = await requireUser();
  const [wallets, assets] = await Promise.all([
    getUserWallets(user.id),
    getUserAssets(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/transactions"
          className="text-sm text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
        >
          ← Toutes les transactions
        </Link>
        <h1 className={`mt-2 ${ui.heading}`}>Import en masse</h1>
        <p className={`mt-1 ${ui.subtle}`}>
          Importez d&apos;un coup toutes les transactions d&apos;un asset
          (par exemple depuis un tableur).
        </p>
      </div>

      <ol className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-300">
        <li>1. Choisissez le wallet et l&apos;asset de destination.</li>
        <li>
          2. Dans votre tableur, sélectionnez 4 colonnes dans cet ordre :{" "}
          <strong>Date</strong>, <strong>Montant investi</strong>,{" "}
          <strong>Quantité</strong>, <strong>Prix unitaire</strong>.
        </li>
        <li>3. Copiez-les (Ctrl+C) et collez-les dans la zone ci-dessous.</li>
        <li>
          4. Vérifiez l&apos;aperçu, puis cliquez sur Importer. Un montant
          négatif est traité comme une vente.
        </li>
      </ol>

      {wallets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Créez d&apos;abord un wallet sur la page{" "}
          <Link
            href="/wallets"
            className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Wallets
          </Link>
          .
        </div>
      ) : (
        <TransactionImport
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
        />
      )}
    </div>
  );
}

import Link from "next/link";
import { requireUser } from "@/lib/auth-server";
import { getUserWallets } from "@/lib/wallets";
import { getUserAssets } from "@/lib/assets";
import { ui } from "@/lib/ui";
import { CmcImport } from "@/components/cmc-import";
import { TrImport } from "@/components/tr-import";
import { TransactionImport } from "@/components/transaction-import";

export default async function TransactionImportPage() {
  const user = await requireUser();
  const [wallets, assets] = await Promise.all([
    getUserWallets(user.id),
    getUserAssets(user.id),
  ]);

  const walletOptions = wallets.map((w) => ({
    id: w.id,
    name: w.name,
    currency: w.currency,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/transactions"
          className="text-sm text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
        >
          ← Toutes les transactions
        </Link>
        <h1 className={`mt-2 ${ui.heading}`}>Import en masse</h1>
        <p className={`mt-1 ${ui.subtle}`}>
          Importez d&apos;un coup tout votre historique de transactions.
        </p>
      </div>

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
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Depuis CoinMarketCap
            </h2>
            <p className={ui.subtle}>
              Exportez votre historique de transactions depuis CoinMarketCap
              (fichier .csv), choisissez le wallet de destination et déposez le
              fichier. Les assets sont créés automatiquement et leur prix en
              direct est résolu pour vous. Une ligne avec un montant négatif
              est traitée comme une vente.
            </p>
            <CmcImport wallets={walletOptions} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Depuis Trade Republic
            </h2>
            <p className={ui.subtle}>
              Exportez votre historique de transactions Trade Republic
              (fichier .csv), choisissez le wallet de destination et déposez le
              fichier. Les actions et ETF sont identifiés par leur code ISIN,
              résolu automatiquement pour récupérer le prix en direct.
            </p>
            <TrImport wallets={walletOptions} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Coller des lignes (autre tableur)
            </h2>
            <ol className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-300">
              <li>1. Choisissez le wallet et l&apos;asset de destination.</li>
              <li>
                2. Dans votre tableur, sélectionnez 4 colonnes dans cet ordre :{" "}
                <strong>Date</strong>, <strong>Montant investi</strong>,{" "}
                <strong>Quantité</strong>, <strong>Prix unitaire</strong>.
              </li>
              <li>
                3. Copiez-les (Ctrl+C) et collez-les dans la zone ci-dessous.
              </li>
              <li>
                4. Vérifiez l&apos;aperçu, puis cliquez sur Importer. Un montant
                négatif est traité comme une vente.
              </li>
            </ol>
            <TransactionImport
              wallets={walletOptions}
              assets={assets.map((a) => ({
                id: a.id,
                name: a.name,
                symbol: a.symbol,
              }))}
            />
          </section>
        </>
      )}
    </div>
  );
}

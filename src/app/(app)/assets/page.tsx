import Link from "next/link";
import { requireProfile } from "@/lib/auth-server";
import { getProfileAssets } from "@/lib/assets";
import { ASSET_TYPE_LABELS, type AssetType } from "@/lib/constants";
import { ui } from "@/lib/ui";
import { AssetForm } from "@/components/asset-form";
import { DeleteButton } from "@/components/delete-button";
import { deleteAssetAction } from "./actions";

export default async function AssetsPage() {
  const { profile } = await requireProfile();
  const assets = await getProfileAssets(profile.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className={ui.heading}>Assets</h1>
        <p className={`mt-1 ${ui.subtle}`}>
          Le catalogue de vos actions, ETF et cryptos. L&apos;identifiant
          externe permet de récupérer le prix en direct.
        </p>
      </header>

      <AssetForm />

      {assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Aucun asset pour l&apos;instant. Ajoutez-en un ci-dessus, ou
          créez-en directement depuis le formulaire de transaction.
        </div>
      ) : (
        <div className={`${ui.card} overflow-x-auto p-0`}>
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Symbole</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Cotation</th>
                <th className="px-4 py-3 font-medium">Identifiant prix</th>
                <th className="px-4 py-3 font-medium">Transactions</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const externalId =
                  asset.type === "CRYPTO"
                    ? asset.coingeckoId
                    : asset.yahooSymbol;
                return (
                  <tr
                    key={asset.id}
                    className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/assets/${asset.id}`}
                        className="font-medium text-black hover:text-emerald-600 dark:text-zinc-50 dark:hover:text-emerald-400"
                      >
                        {asset.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                      {asset.symbol}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {ASSET_TYPE_LABELS[asset.type as AssetType] ?? asset.type}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {asset.quoteCurrency}
                    </td>
                    <td className="px-4 py-3">
                      {externalId ? (
                        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
                          {externalId}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          non renseigné
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {asset._count.transactions}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {asset._count.transactions === 0 ? (
                        <DeleteButton
                          action={deleteAssetAction}
                          id={asset.id}
                          confirmMessage={`Supprimer l'asset « ${asset.name} » ?`}
                        />
                      ) : (
                        <Link
                          href={`/assets/${asset.id}`}
                          className="text-xs text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                          Modifier
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

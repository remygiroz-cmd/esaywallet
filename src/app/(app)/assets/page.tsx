import { requireProfile } from "@/lib/auth-server";
import { getProfileAssets } from "@/lib/assets";
import { ui } from "@/lib/ui";
import { AssetForm } from "@/components/asset-form";
import { AssetsTable, type AssetRow } from "@/components/assets-table";

export default async function AssetsPage() {
  const { profile } = await requireProfile();
  const assets = await getProfileAssets(profile.id);

  const rows: AssetRow[] = assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    symbol: asset.symbol,
    type: asset.type,
    quoteCurrency: asset.quoteCurrency,
    coingeckoId: asset.coingeckoId,
    yahooSymbol: asset.yahooSymbol,
    transactionCount: asset._count.transactions,
    incomeCount: asset._count.income,
    priceAlertCount: asset._count.priceAlerts,
  }));

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

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Aucun asset pour l&apos;instant. Ajoutez-en un ci-dessus, ou
          créez-en directement depuis le formulaire de transaction.
        </div>
      ) : (
        <AssetsTable assets={rows} />
      )}
    </div>
  );
}

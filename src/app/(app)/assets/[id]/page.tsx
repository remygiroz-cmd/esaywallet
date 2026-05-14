import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-server";
import { getAsset } from "@/lib/assets";
import { ASSET_TYPE_LABELS, type AssetType } from "@/lib/constants";
import { ui } from "@/lib/ui";
import { AssetForm } from "@/components/asset-form";
import { DeleteButton } from "@/components/delete-button";
import { deleteAssetAction } from "../actions";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const asset = await getAsset(id, user.id);

  if (!asset) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/assets"
          className="text-sm text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
        >
          ← Tous les assets
        </Link>
        <h1 className={`mt-2 ${ui.heading}`}>
          {asset.name}{" "}
          <span className="font-mono text-base text-zinc-400">
            {asset.symbol}
          </span>
        </h1>
        <p className={`mt-1 ${ui.subtle}`}>
          {ASSET_TYPE_LABELS[asset.type as AssetType] ?? asset.type} · coté en{" "}
          {asset.quoteCurrency}
        </p>
      </div>

      <AssetForm asset={asset} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Suppression
        </h2>
        {asset._count.transactions === 0 ? (
          <div
            className={`${ui.card} flex flex-wrap items-center justify-between gap-3`}
          >
            <p className={ui.subtle}>
              Cet asset n&apos;est utilisé par aucune transaction.
            </p>
            <DeleteButton
              action={deleteAssetAction}
              id={asset.id}
              label="Supprimer l'asset"
              confirmMessage={`Supprimer l'asset « ${asset.name} » ?`}
            />
          </div>
        ) : (
          <div className={`${ui.card} ${ui.subtle}`}>
            Cet asset est utilisé par {asset._count.transactions} transaction
            {asset._count.transactions === 1 ? "" : "s"} et ne peut pas être
            supprimé. Supprimez d&apos;abord les transactions concernées.
          </div>
        )}
      </section>
    </div>
  );
}

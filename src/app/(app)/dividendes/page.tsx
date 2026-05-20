import { requireProfile } from "@/lib/auth-server";
import { getProfileWallets } from "@/lib/wallets";
import { getProfileAssets } from "@/lib/assets";
import { getProfileDividends } from "@/lib/dividends";
import { ui } from "@/lib/ui";
import { toDateInputValue } from "@/lib/format";
import { DividendForm } from "@/components/dividend-form";
import { DividendsView } from "@/components/dividends-view";

export default async function DividendesPage() {
  const { profile } = await requireProfile();
  const [wallets, assets, dividends] = await Promise.all([
    getProfileWallets(profile.id),
    getProfileAssets(profile.id),
    getProfileDividends(profile.id),
  ]);

  const rows = dividends.map((dividend) => ({
    id: dividend.id,
    source: dividend.source,
    receivedAt: dividend.receivedAt.toISOString(),
    grossAmount: dividend.grossAmount.toNumber(),
    withheldTax: dividend.withheldTax.toNumber(),
    currency: dividend.currency,
    taxRate: dividend.taxRate ?? null,
    notes: dividend.notes,
    wallet: dividend.wallet
      ? {
          id: dividend.wallet.id,
          name: dividend.wallet.name,
          type: dividend.wallet.type,
        }
      : null,
    asset: dividend.asset
      ? {
          id: dividend.asset.id,
          name: dividend.asset.name,
          symbol: dividend.asset.symbol,
        }
      : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className={ui.heading}>Dividendes</h1>
        <p className={`mt-1 ${ui.subtle}`}>
          Suivi des dividendes reçus pour la déclaration d&apos;impôt.
          N&apos;impacte ni le cash, ni le capital, ni la valeur des wallets.
        </p>
      </header>

      <DividendForm
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
        defaultDate={toDateInputValue(new Date())}
      />

      <DividendsView dividends={rows} />
    </div>
  );
}

import { requireProfile } from "@/lib/auth-server";
import { loadFiscalData } from "@/lib/fiscalite";
import { ui } from "@/lib/ui";
import { FiscaliteView } from "@/components/fiscalite-view";

export default async function FiscalitePage() {
  const { profile } = await requireProfile();
  const data = await loadFiscalData(profile.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className={ui.heading}>Fiscalité</h1>
        <p className={`mt-1 ${ui.subtle}`}>
          Récapitulatif de vos plus et moins-values réalisées sur une période,
          pour vous aider à préparer votre déclaration.
        </p>
      </header>

      {data.sales.length === 0 &&
      data.income.length === 0 &&
      data.dividends.length === 0 &&
      data.withdrawals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Aucune vente ni revenu enregistré. Les ventes, dividendes et revenus
          que vous saisirez apparaîtront ici, regroupés par année.
        </div>
      ) : (
        <FiscaliteView
          sales={data.sales}
          income={data.income}
          dividends={data.dividends}
          withdrawals={data.withdrawals}
          adjustments={data.adjustments}
        />
      )}
    </div>
  );
}

import { requireUser } from "@/lib/auth-server";
import { getUserAssets } from "@/lib/assets";
import { getUserAlerts } from "@/lib/alerts";
import { ALERT_DIRECTION_LABELS, type AlertDirection } from "@/lib/constants";
import { ui } from "@/lib/ui";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { AlertForm } from "@/components/alert-form";
import { DeleteButton } from "@/components/delete-button";
import { deleteAlertAction, rearmAlertAction } from "./actions";

export default async function AlertesPage() {
  const user = await requireUser();
  const [assets, alerts] = await Promise.all([
    getUserAssets(user.id),
    getUserAlerts(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className={ui.heading}>Alertes de prix</h1>
        <p className={`mt-1 ${ui.subtle}`}>
          Définissez un seuil de prix par asset : l&apos;alerte se déclenche
          dès que le cours le franchit et apparaît sur le tableau de bord.
        </p>
      </header>

      {assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Créez d&apos;abord un asset pour pouvoir définir une alerte.
        </div>
      ) : (
        <AlertForm
          assets={assets.map((asset) => ({
            id: asset.id,
            name: asset.name,
            symbol: asset.symbol,
            quoteCurrency: asset.quoteCurrency,
            currentPrice: asset.price?.price.toNumber() ?? null,
          }))}
        />
      )}

      {alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Aucune alerte définie.
        </div>
      ) : (
        <div className={`${ui.card} overflow-x-auto p-0`}>
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Condition</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr
                  key={alert.id}
                  className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-black dark:text-zinc-50">
                      {alert.asset.name}
                    </span>{" "}
                    <span className="font-mono text-xs text-zinc-400">
                      {alert.asset.symbol}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                    {ALERT_DIRECTION_LABELS[alert.direction as AlertDirection]}{" "}
                    {formatCurrency(
                      alert.threshold.toNumber(),
                      alert.asset.quoteCurrency,
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {alert.triggeredAt ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        Déclenchée le {formatDateTime(alert.triggeredAt)}
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {alert.note ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {alert.triggeredAt ? (
                        <form action={rearmAlertAction}>
                          <input
                            type="hidden"
                            name="id"
                            value={alert.id}
                          />
                          <button
                            type="submit"
                            className={ui.secondaryButton}
                          >
                            Réarmer
                          </button>
                        </form>
                      ) : null}
                      <DeleteButton
                        action={deleteAlertAction}
                        id={alert.id}
                        label="Suppr."
                        confirmMessage="Supprimer cette alerte ?"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { requireUser } from "@/lib/auth-server";
import { ui } from "@/lib/ui";

export default async function ParametresPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className={ui.heading}>Paramètres</h1>
        <p className={`mt-1 ${ui.subtle}`}>Votre compte et vos données.</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Compte
        </h2>
        <div className={`${ui.card} flex flex-col gap-1 text-sm`}>
          <p className="text-zinc-700 dark:text-zinc-200">
            {user.name ?? "—"}
          </p>
          <p className="text-zinc-500 dark:text-zinc-400">{user.email}</p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Sauvegarde &amp; export
        </h2>
        <div className={`${ui.card} flex flex-col gap-3`}>
          <p className={ui.subtle}>
            Exportez vos données pour les conserver ou les réutiliser
            ailleurs.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/export?format=json"
              className={ui.primaryButton}
              download
            >
              Télécharger la sauvegarde (JSON)
            </a>
            <a
              href="/api/export?format=csv"
              className={ui.secondaryButton}
              download
            >
              Exporter les transactions (CSV)
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

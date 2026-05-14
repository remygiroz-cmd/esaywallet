import { requireUser } from "@/lib/auth-server";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Tableau de bord
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Bienvenue {user.name ?? user.email}.
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
        Le suivi en temps réel de vos plus et moins-values s&apos;affichera ici
        une fois vos wallets et vos achats enregistrés.
      </div>
    </div>
  );
}

const LEVELS = [
  {
    title: "Par achat",
    description:
      "Plus ou moins-value de chaque achat individuel, calculée en direct.",
  },
  {
    title: "Par asset",
    description:
      "Agrégation de tous les achats d'un même asset, avec prix de revient moyen.",
  },
  {
    title: "Par wallet",
    description: "Performance globale de chaque wallet (CTO, PEA, crypto…).",
  },
  {
    title: "Global",
    description: "Vue consolidée de l'ensemble de vos wallets.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-20 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-12">
        <header className="flex flex-col gap-4">
          <span className="text-sm font-medium uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            easyWallet
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Suivez vos investissements en temps réel
          </h1>
          <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Répartissez vos placements en wallets, enregistrez chaque achat
            (asset, date, prix, montant investi, quantité) et suivez
            l&apos;évolution de vos plus et moins-values à la minute.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {LEVELS.map((level) => (
            <div
              key={level.title}
              className="rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.12] dark:bg-zinc-950"
            >
              <h2 className="text-base font-semibold text-black dark:text-zinc-50">
                {level.title}
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {level.description}
              </p>
            </div>
          ))}
        </section>

        <footer className="text-sm text-zinc-500 dark:text-zinc-500">
          Projet en cours de construction — phase 0 : socle technique en place.
        </footer>
      </main>
    </div>
  );
}

import { requireProfile } from "@/lib/auth-server";
import { getUserProfiles } from "@/lib/profiles";
import { formatDate } from "@/lib/format";
import { ui } from "@/lib/ui";
import { DeleteButton } from "@/components/delete-button";
import { ProfileCreateForm, ProfileRenameForm } from "./forms";
import { deleteProfileAction } from "./actions";

export default async function ProfilsPage() {
  const { user, profile: active } = await requireProfile();
  const profiles = await getUserProfiles(user.id);
  const onlyOne = profiles.length <= 1;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className={ui.heading}>Profils</h1>
        <p className={`mt-1 ${ui.subtle}`}>
          Un compte peut héberger plusieurs portefeuilles isolés (le vôtre,
          celui d&apos;un enfant, d&apos;un partenaire…). Chaque profil a ses
          propres wallets, transactions et documents — basculez via le menu
          en haut de la page.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Ajouter un profil
        </h2>
        <ProfileCreateForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Profils existants
        </h2>
        <ul className="flex flex-col gap-2">
          {profiles.map((profile) => (
            <li key={profile.id} className={`${ui.card} flex flex-col gap-3`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-black dark:text-zinc-50">
                    {profile.name}
                    {profile.id === active.id ? (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        actif
                      </span>
                    ) : null}
                    {profile.isDefault ? (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                        par défaut
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-zinc-400">
                    Créé le {formatDate(profile.createdAt)} ·{" "}
                    {profile._count.wallets} wallet
                    {profile._count.wallets === 1 ? "" : "s"} ·{" "}
                    {profile._count.assets} asset
                    {profile._count.assets === 1 ? "" : "s"}
                  </p>
                </div>
                {!onlyOne ? (
                  <DeleteButton
                    action={deleteProfileAction}
                    id={profile.id}
                    label="Supprimer"
                    confirmMessage={`Supprimer « ${profile.name} » ? Tout le portefeuille de ce profil (wallets, transactions, documents…) sera définitivement effacé.`}
                  />
                ) : null}
              </div>
              <ProfileRenameForm id={profile.id} currentName={profile.name} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

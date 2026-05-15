import Link from "next/link";
import { requireProfile } from "@/lib/auth-server";
import { logoutAction } from "@/app/(auth)/actions";
import { getUserProfiles } from "@/lib/profiles";
import { AppNav } from "@/components/app-nav";
import { ProfileSwitcher } from "@/components/profile-switcher";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireProfile();
  const profiles = await getUserProfiles(user.id);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-black/[.08] bg-white dark:border-white/[.1] dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3 py-3">
            <Link
              href="/dashboard"
              className="text-base font-semibold tracking-tight text-emerald-600 dark:text-emerald-400"
            >
              easyWallet
            </Link>
            <div className="flex items-center gap-3">
              <ProfileSwitcher
                profiles={profiles.map((p) => ({ id: p.id, name: p.name }))}
                activeProfileId={profile.id}
              />
              <Link
                href="/parametres"
                className="hidden max-w-[10rem] truncate text-sm text-zinc-500 transition-colors hover:text-emerald-600 sm:inline dark:text-zinc-400 dark:hover:text-emerald-400"
              >
                {user.name ?? user.email}
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-white/[.16] dark:text-zinc-400 dark:hover:bg-zinc-900"
                >
                  Déconnexion
                </button>
              </form>
            </div>
          </div>
          {/* Nav scrolls horizontally on very narrow screens. */}
          <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            <AppNav />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}

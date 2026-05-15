"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { switchProfileAction } from "@/app/(app)/profils/actions";

type ProfileOption = {
  id: string;
  name: string;
};

// Switches between profiles. The select submits its parent form on
// change, which is a server action that sets the active-profile cookie
// and redirects back to the page the user was on.
export function ProfileSwitcher({
  profiles,
  activeProfileId,
}: {
  profiles: ProfileOption[];
  activeProfileId: string;
}) {
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);

  if (profiles.length === 0) return null;

  return (
    <form
      ref={formRef}
      action={switchProfileAction}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="next" value={pathname} />
      <select
        name="profileId"
        defaultValue={activeProfileId}
        onChange={() => formRef.current?.requestSubmit()}
        className="max-w-[10rem] truncate rounded-lg border border-black/[.12] bg-white px-2 py-1 text-sm text-zinc-700 dark:border-white/[.16] dark:bg-black dark:text-zinc-200"
        aria-label="Profil actif"
      >
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>
      <Link
        href="/profils"
        className="text-xs text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400"
        title="Gérer les profils"
      >
        Gérer
      </Link>
    </form>
  );
}

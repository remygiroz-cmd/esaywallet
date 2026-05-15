"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";

type ProfileOption = {
  id: string;
  name: string;
};

// Switches between profiles client-side: posts the new profile id to a
// route handler that flips the cookie, then triggers a router.refresh()
// (re-renders server components) plus a react-query invalidate so the
// dashboard's polled data is fetched fresh. No page reload needed.
export function ProfileSwitcher({
  profiles,
  activeProfileId,
}: {
  profiles: ProfileOption[];
  activeProfileId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(activeProfileId);

  if (profiles.length === 0) return null;

  function switchTo(profileId: string) {
    if (profileId === activeProfileId) return;
    setValue(profileId);
    startTransition(async () => {
      const response = await fetch("/api/profile/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      if (!response.ok) {
        setValue(activeProfileId);
        return;
      }
      // Drop every cached query — they're all profile-scoped.
      await queryClient.invalidateQueries();
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(event) => switchTo(event.target.value)}
        disabled={pending}
        className="max-w-[10rem] truncate rounded-lg border border-black/[.12] bg-white px-2 py-1 text-sm text-zinc-700 disabled:opacity-60 dark:border-white/[.16] dark:bg-black dark:text-zinc-200"
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
    </div>
  );
}

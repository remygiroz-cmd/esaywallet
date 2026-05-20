"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/wallets", label: "Wallets" },
  { href: "/assets", label: "Assets" },
  { href: "/transactions", label: "Transactions" },
  { href: "/revenus", label: "Revenus" },
  { href: "/dividendes", label: "Dividendes" },
  { href: "/alertes", label: "Alertes" },
  { href: "/fiscalite", label: "Fiscalité" },
  { href: "/assistant-fiscal", label: "Assistant fiscal" },
  { href: "/verifications", label: "Vérifications" },
  { href: "/documents", label: "Documents" },
  { href: "/profils", label: "Profils" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex w-max items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} prefetch>
            <NavLabel label={item.label} active={active} />
          </Link>
        );
      })}
    </nav>
  );
}

// Rendered inside <Link> so it can read the navigation's pending state.
// While Next.js is fetching the destination's server-rendered content,
// the label dims slightly so the click feels acknowledged immediately.
function NavLabel({ label, active }: { label: string; active: boolean }) {
  const { pending } = useLinkStatus();
  const className = pending
    ? "bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
    : active
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900";

  return (
    <span
      className={`block shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${className}`}
    >
      {label}
    </span>
  );
}

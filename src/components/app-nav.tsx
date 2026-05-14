"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/wallets", label: "Wallets" },
  { href: "/assets", label: "Assets" },
  { href: "/transactions", label: "Transactions" },
  { href: "/revenus", label: "Revenus" },
  { href: "/alertes", label: "Alertes" },
  { href: "/fiscalite", label: "Fiscalité" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex w-max items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

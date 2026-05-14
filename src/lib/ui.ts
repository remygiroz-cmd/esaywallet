// Shared Tailwind class strings — keeps form/card styling consistent.
export const ui = {
  card: "rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.12] dark:bg-zinc-950",
  input:
    "w-full rounded-lg border border-black/[.12] bg-white px-3 py-2 text-sm text-black outline-none focus:border-emerald-500 dark:border-white/[.16] dark:bg-black dark:text-zinc-50",
  label:
    "flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300",
  primaryButton:
    "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60",
  secondaryButton:
    "rounded-lg border border-black/[.12] px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:border-white/[.16] dark:text-zinc-400 dark:hover:bg-zinc-900",
  dangerButton:
    "rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950",
  errorText:
    "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300",
  heading: "text-2xl font-semibold tracking-tight text-black dark:text-zinc-50",
  subtle: "text-sm text-zinc-500 dark:text-zinc-400",
} as const;

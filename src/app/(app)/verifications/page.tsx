import Link from "next/link";
import { requireProfile } from "@/lib/auth-server";
import { loadReviewItems, type ReviewSeverity } from "@/lib/review";
import { ui } from "@/lib/ui";

const SEVERITY_STYLE: Record<
  ReviewSeverity,
  { badge: string; label: string; dot: string }
> = {
  error: {
    badge:
      "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    label: "À corriger",
    dot: "bg-red-500",
  },
  warning: {
    badge:
      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    label: "À vérifier",
    dot: "bg-amber-500",
  },
  info: {
    badge:
      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    label: "Info",
    dot: "bg-zinc-400",
  },
};

export default async function VerificationsPage() {
  const { profile } = await requireProfile();
  const items = await loadReviewItems(profile.id);

  const counts = {
    error: items.filter((i) => i.severity === "error").length,
    warning: items.filter((i) => i.severity === "warning").length,
    info: items.filter((i) => i.severity === "info").length,
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className={ui.heading}>Vérifications</h1>
        <p className={`mt-1 ${ui.subtle}`}>
          Les manques et incohérences détectés dans vos données. Corrigez-les
          manuellement pour fiabiliser les plus-values et le calcul d&apos;impôt.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 p-8 text-center text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
          ✓ Tout est en ordre — aucune incohérence détectée.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            {(["error", "warning", "info"] as const).map((severity) =>
              counts[severity] > 0 ? (
                <span
                  key={severity}
                  className={`rounded-full px-2.5 py-1 font-medium ${SEVERITY_STYLE[severity].badge}`}
                >
                  {counts[severity]} {SEVERITY_STYLE[severity].label}
                </span>
              ) : null,
            )}
          </div>

          <ul className="flex flex-col gap-3">
            {items.map((item) => {
              const style = SEVERITY_STYLE[item.severity];
              return (
                <li
                  key={item.id}
                  className={`${ui.card} flex flex-wrap items-start justify-between gap-3`}
                >
                  <div className="flex min-w-0 gap-3">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-black dark:text-zinc-50">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="shrink-0 rounded-lg border border-black/[.12] px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-white/[.16] dark:text-zinc-400 dark:hover:bg-zinc-900"
                    >
                      {item.hrefLabel ?? "Ouvrir"}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import type { FiscalReport } from "@/lib/fiscal-assistant";
import { formatCurrency } from "@/lib/format";
import { ui } from "@/lib/ui";

const CONFIDENCE_STYLE: Record<
  FiscalReport["confidence"],
  { label: string; className: string }
> = {
  high: {
    label: "Confiance élevée",
    className:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  medium: {
    label: "Confiance moyenne",
    className:
      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  low: {
    label: "Confiance faible — à vérifier de près",
    className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

export function FiscalAssistant({ defaultYear }: { defaultYear: number }) {
  const [year, setYear] = useState(defaultYear);
  const [answers, setAnswers] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FiscalReport | null>(null);

  async function analyze() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant-fiscal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taxYear: year, answers }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "L'analyse a échoué.");
        return;
      }
      setReport(body.report as FiscalReport);
    } catch {
      setError("L'analyse a échoué — vérifiez votre connexion.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={`${ui.card} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-end gap-4">
          <label className={`${ui.label} sm:w-40`}>
            Année fiscale
            <input
              type="number"
              min="1990"
              max="2100"
              value={year}
              onChange={(event) =>
                setYear(Number(event.target.value) || year)
              }
              className={ui.input}
            />
          </label>
          <button
            type="button"
            onClick={analyze}
            disabled={pending}
            className={ui.primaryButton}
          >
            {pending ? "Analyse en cours…" : "Analyser mes documents"}
          </button>
        </div>
        <p className="text-xs text-zinc-400">
          L&apos;assistant lit les documents de votre coffre pour
          l&apos;année choisie, les recoupe avec les données de
          l&apos;application, et propose un brouillon de déclaration.
          L&apos;analyse peut prendre jusqu&apos;à une minute.
        </p>
        {pending ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Lecture des relevés, rapprochement des transactions, calcul des
            montants…
          </p>
        ) : null}
        {error ? <p className={ui.errorText}>{error}</p> : null}
      </div>

      {report ? (
        <div className="flex flex-col gap-6">
          <div className={`${ui.card} flex flex-col gap-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Synthèse — déclaration {report.taxYear}
              </h2>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  CONFIDENCE_STYLE[report.confidence].className
                }`}
              >
                {CONFIDENCE_STYLE[report.confidence].label}
              </span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {report.summary}
            </p>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              Brouillon généré par IA — à vérifier avant toute déclaration.
              Ne remplace pas un conseiller fiscal.
            </p>
          </div>

          {report.declarationLines.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Montants à déclarer
              </h2>
              <div className={`${ui.card} overflow-x-auto p-0`}>
                <table className="w-full min-w-[44rem] text-sm">
                  <thead>
                    <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
                      <th className="px-4 py-3 font-medium">Formulaire</th>
                      <th className="px-4 py-3 font-medium">Case</th>
                      <th className="px-4 py-3 font-medium">Libellé</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Montant
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.declarationLines.map((line, index) => (
                      <tr
                        key={index}
                        className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                      >
                        <td className="px-4 py-3 font-medium text-black dark:text-zinc-50">
                          {line.form}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-700 dark:text-zinc-200">
                          {line.box}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                          {line.label}
                          <span className="mt-0.5 block text-xs text-zinc-400">
                            {line.basis}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-black dark:text-zinc-50">
                          {formatCurrency(line.amount, "EUR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {report.foreignAccounts.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Comptes à l&apos;étranger à déclarer
              </h2>
              <ul className="flex flex-col gap-2">
                {report.foreignAccounts.map((account, index) => (
                  <li key={index} className={`${ui.card} text-sm`}>
                    <span className="font-medium text-black dark:text-zinc-50">
                      {account.form}
                    </span>{" "}
                    — {account.institution} ({account.country})
                    <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                      {account.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {report.warnings.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Points d&apos;attention
              </h2>
              <ul className="flex flex-col gap-1.5 text-sm text-amber-700 dark:text-amber-300">
                {report.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {report.missingDocuments.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Justificatifs manquants
              </h2>
              <ul className="flex flex-col gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
                {report.missingDocuments.map((item, index) => (
                  <li key={index}>• {item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {report.questions.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Questions de l&apos;assistant
              </h2>
              <ul className="flex flex-col gap-2">
                {report.questions.map((question, index) => (
                  <li key={index} className={`${ui.card} text-sm`}>
                    <span className="font-medium text-black dark:text-zinc-50">
                      {question.topic}
                    </span>
                    <p className="mt-0.5 text-zinc-600 dark:text-zinc-300">
                      {question.question}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {question.why}
                    </p>
                  </li>
                ))}
              </ul>
              <label className={ui.label}>
                Vos réponses
                <textarea
                  value={answers}
                  onChange={(event) => setAnswers(event.target.value)}
                  rows={4}
                  placeholder="Répondez aux questions ci-dessus, puis relancez l'analyse pour affiner le brouillon."
                  className={ui.input}
                />
              </label>
              <div>
                <button
                  type="button"
                  onClick={analyze}
                  disabled={pending}
                  className={ui.primaryButton}
                >
                  {pending
                    ? "Analyse en cours…"
                    : "Relancer avec mes réponses"}
                </button>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

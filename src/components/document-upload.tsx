"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
} from "@/lib/constants";
import { ui } from "@/lib/ui";

export function DocumentUpload() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped after each upload to remount the form and clear the fields.
  const [formKey, setFormKey] = useState(0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Sélectionnez un fichier.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: data,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "L'envoi a échoué.");
        return;
      }
      setFormKey((key) => key + 1);
      router.refresh();
    } catch {
      setError("L'envoi a échoué — vérifiez votre connexion.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      key={formKey}
      onSubmit={handleSubmit}
      className={`${ui.card} flex flex-col gap-4`}
    >
      <label className={ui.label}>
        Fichier (PDF, CSV, image — 10 Mo max)
        <input
          type="file"
          name="file"
          accept=".pdf,.csv,.txt,.xls,.xlsx,.png,.jpg,.jpeg,application/pdf,text/csv,image/png,image/jpeg"
          required
          className="w-full rounded-lg border border-black/[.12] bg-white px-3 py-2 text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white dark:border-white/[.16] dark:bg-black dark:text-zinc-300"
        />
      </label>

      <div className="flex flex-col gap-4 sm:flex-row">
        <label className={`${ui.label} flex-1`}>
          Catégorie
          <select name="category" defaultValue="RELEVE" className={ui.input}>
            {DOCUMENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {DOCUMENT_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </label>
        <label className={`${ui.label} sm:w-40`}>
          Année (optionnel)
          <input
            name="year"
            type="number"
            min="1990"
            max="2100"
            placeholder="2025"
            className={ui.input}
          />
        </label>
      </div>

      <label className={ui.label}>
        Note (optionnel)
        <input
          name="note"
          maxLength={200}
          placeholder="Ex. : IFU Boursorama CTO"
          className={ui.input}
        />
      </label>

      {error ? <p className={ui.errorText}>{error}</p> : null}

      <div>
        <button
          type="submit"
          disabled={pending}
          className={ui.primaryButton}
        >
          {pending ? "Envoi en cours…" : "Ajouter au coffre"}
        </button>
      </div>
    </form>
  );
}

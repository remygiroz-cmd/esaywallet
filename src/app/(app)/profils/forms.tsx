"use client";

import { useActionState } from "react";
import {
  createProfileAction,
  renameProfileAction,
  type ProfileFormState,
} from "./actions";
import { ui } from "@/lib/ui";

const initialState: ProfileFormState = {};

export function ProfileCreateForm() {
  const [state, formAction, pending] = useActionState(
    createProfileAction,
    initialState,
  );

  return (
    <form
      key={state.submittedAt ?? 0}
      action={formAction}
      className={`${ui.card} flex flex-col gap-3 sm:flex-row sm:items-end`}
    >
      <label className={`${ui.label} flex-1`}>
        Nom du profil
        <input
          name="name"
          maxLength={60}
          required
          placeholder="Portefeuille de Lucie"
          className={ui.input}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className={ui.primaryButton}
      >
        {pending ? "Création…" : "Créer le profil"}
      </button>
      {state.error ? (
        <p className={`${ui.errorText} sm:basis-full`}>{state.error}</p>
      ) : null}
    </form>
  );
}

export function ProfileRenameForm({
  id,
  currentName,
}: {
  id: string;
  currentName: string;
}) {
  const [state, formAction, pending] = useActionState(
    renameProfileAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="id" value={id} />
      <label className={`${ui.label} flex-1`}>
        Renommer
        <input
          name="name"
          defaultValue={currentName}
          maxLength={60}
          required
          className={ui.input}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className={ui.secondaryButton}
      >
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
      {state.error ? (
        <p className={`${ui.errorText} sm:basis-full`}>{state.error}</p>
      ) : null}
    </form>
  );
}

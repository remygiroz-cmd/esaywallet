"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthState } from "../actions";

const initialState: AuthState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <div className="rounded-2xl border border-black/[.08] bg-white p-6 shadow-sm dark:border-white/[.12] dark:bg-zinc-950">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
        Connexion
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Accédez à vos wallets et à votre suivi en temps réel.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-lg border border-black/[.12] bg-white px-3 py-2 text-base text-black outline-none focus:border-emerald-500 dark:border-white/[.16] dark:bg-black dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Mot de passe
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-lg border border-black/[.12] bg-white px-3 py-2 text-base text-black outline-none focus:border-emerald-500 dark:border-white/[.16] dark:bg-black dark:text-zinc-50"
          />
        </label>

        {state.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
        >
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Pas encore de compte ?{" "}
        <Link
          href="/register"
          className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Créer un compte
        </Link>
      </p>
    </div>
  );
}

import Link from "next/link";
import { requireUser } from "@/lib/auth-server";
import { getUserDocuments } from "@/lib/documents";
import { ui } from "@/lib/ui";
import { FiscalAssistant } from "@/components/fiscal-assistant";

export default async function AssistantFiscalPage() {
  const user = await requireUser();
  const documents = await getUserDocuments(user.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className={ui.heading}>Assistant fiscal</h1>
        <p className={`mt-1 ${ui.subtle}`}>
          L&apos;assistant analyse les documents de votre coffre et les
          données de l&apos;application pour proposer un brouillon de
          déclaration : montants, cases, formulaires, et les questions à
          régler. C&apos;est une aide à la préparation — à vérifier avant de
          déclarer.
        </p>
      </header>

      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Déposez d&apos;abord vos relevés et exports dans le{" "}
          <Link
            href="/documents"
            className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            coffre à documents
          </Link>{" "}
          : l&apos;assistant s&apos;en sert pour recouper vos opérations. Vous
          pouvez aussi lancer une analyse sur les seules données de
          l&apos;application.
        </div>
      ) : null}

      <FiscalAssistant defaultYear={new Date().getFullYear() - 1} />
    </div>
  );
}

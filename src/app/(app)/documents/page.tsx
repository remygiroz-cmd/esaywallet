import { requireProfile } from "@/lib/auth-server";
import { getProfileDocuments } from "@/lib/documents";
import {
  DOCUMENT_CATEGORY_LABELS,
  type DocumentCategory,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { ui } from "@/lib/ui";
import { DocumentUpload } from "@/components/document-upload";
import { DeleteButton } from "@/components/delete-button";
import { deleteDocumentAction } from "./actions";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default async function DocumentsPage() {
  const { profile } = await requireProfile();
  const documents = await getProfileDocuments(profile.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className={ui.heading}>Coffre à documents</h1>
        <p className={`mt-1 ${ui.subtle}`}>
          Rassemblez ici tous vos justificatifs : relevés bancaires, exports
          de courtiers, documents fiscaux. Les fichiers sont stockés dans
          votre base de données et ne sont accessibles qu&apos;à vous, via
          votre session.
        </p>
      </header>

      <DocumentUpload />

      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[.15] bg-white p-8 text-center text-sm text-zinc-500 dark:border-white/[.15] dark:bg-zinc-950 dark:text-zinc-400">
          Aucun document dans le coffre pour l&apos;instant.
        </div>
      ) : (
        <div className={`${ui.card} overflow-x-auto p-0`}>
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-black/[.08] text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.1] dark:text-zinc-400">
                <th className="px-4 py-3 font-medium">Fichier</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium">Année</th>
                <th className="px-4 py-3 font-medium">Ajouté le</th>
                <th className="px-4 py-3 text-right font-medium">Taille</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-b border-black/[.05] last:border-0 dark:border-white/[.06]"
                >
                  <td className="px-4 py-3">
                    <a
                      href={`/api/documents/${doc.id}`}
                      className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      {doc.name}
                    </a>
                    {doc.note ? (
                      <p className="text-xs text-zinc-400">{doc.note}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {DOCUMENT_CATEGORY_LABELS[
                      doc.category as DocumentCategory
                    ] ?? doc.category}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {doc.year ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600 dark:text-zinc-300">
                    {formatDate(doc.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                    {formatBytes(doc.size)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <a
                        href={`/api/documents/${doc.id}`}
                        className="text-xs text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                      >
                        Télécharger
                      </a>
                      <DeleteButton
                        action={deleteDocumentAction}
                        id={doc.id}
                        label="Suppr."
                        confirmMessage="Supprimer ce document du coffre ?"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

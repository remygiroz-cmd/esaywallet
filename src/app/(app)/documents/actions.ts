"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-server";
import { deleteDocument } from "@/lib/documents";

export async function deleteDocumentAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) await deleteDocument(id, user.id);
  revalidatePath("/documents");
  redirect("/documents");
}

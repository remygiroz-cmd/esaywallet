"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth-server";
import { deleteDocument } from "@/lib/documents";

export async function deleteDocumentAction(
  formData: FormData,
): Promise<void> {
  const { profile } = await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (id) await deleteDocument(id, profile.id);
  revalidatePath("/documents");
  redirect("/documents");
}

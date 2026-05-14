import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import {
  DOCUMENT_CATEGORIES,
  type DocumentCategory,
} from "@/lib/constants";
import {
  createDocument,
  MAX_DOCUMENT_BYTES,
  ALLOWED_DOCUMENT_MIME_TYPES,
} from "@/lib/documents";

export const dynamic = "force-dynamic";

// Uploads a file into the document vault. Multipart so it isn't bound by
// the (small) server-action body limit; the bytes are stored in the
// database and only ever served back through GET /api/documents/[id].
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Aucun fichier fourni." },
      { status: 400 },
    );
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (10 Mo maximum)." },
      { status: 400 },
    );
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: "Type de fichier non pris en charge (PDF, CSV, image…)." },
      { status: 400 },
    );
  }

  const category = String(formData.get("category") ?? "");
  if (!DOCUMENT_CATEGORIES.includes(category as DocumentCategory)) {
    return NextResponse.json(
      { error: "Catégorie invalide." },
      { status: 400 },
    );
  }

  const yearRaw = String(formData.get("year") ?? "").trim();
  const yearNumber = yearRaw ? Number(yearRaw) : NaN;
  const year =
    Number.isInteger(yearNumber) && yearNumber >= 1990 && yearNumber <= 2100
      ? yearNumber
      : null;
  const note =
    String(formData.get("note") ?? "")
      .trim()
      .slice(0, 200) || null;

  const content = new Uint8Array(await file.arrayBuffer());
  const doc = await createDocument(user.id, {
    name: file.name.slice(0, 200) || "document",
    mimeType,
    size: file.size,
    category: category as DocumentCategory,
    year,
    note,
    content,
  });

  return NextResponse.json({ id: doc.id });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getDocumentContent } from "@/lib/documents";

export const dynamic = "force-dynamic";

// Streams a stored document back to its owner. Scoped by userId, so a
// document can never be fetched by anyone else — there is no public URL.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const doc = await getDocumentContent(id, user.id);
  if (!doc) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  // Keep the filename header safe — strip quotes and control characters.
  const safeName = doc.name.replace(/[^\w.\-() ]+/g, "_");
  return new NextResponse(new Uint8Array(doc.content), {
    headers: {
      "content-type": doc.mimeType,
      "content-disposition": `attachment; filename="${safeName}"`,
      "cache-control": "private, no-store",
    },
  });
}

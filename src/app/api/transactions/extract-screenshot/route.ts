import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth-server";
import { extractTransactionFromScreenshot } from "@/lib/transaction-screenshot";

export const dynamic = "force-dynamic";
// Vision extraction can take a few seconds on a busy day.
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
type AllowedMime = (typeof ALLOWED_MIME)[number];

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Aucune image fournie." },
      { status: 400 },
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image trop volumineuse (8 Mo maximum)." },
      { status: 400 },
    );
  }

  const mimeType = file.type as AllowedMime;
  if (!ALLOWED_MIME.includes(mimeType)) {
    return NextResponse.json(
      { error: "Format non pris en charge (PNG, JPEG, WebP, GIF)." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const result = await extractTransactionFromScreenshot(base64, mimeType);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ extraction: result.data });
}

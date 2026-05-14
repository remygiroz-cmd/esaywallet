import "server-only";
import { prisma } from "@/lib/prisma";
import type { DocumentCategory } from "@/lib/constants";

// Largest file accepted into the vault. Bank statements and broker exports
// are small; this keeps the database lean.
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "text/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
];

export type DocumentInput = {
  name: string;
  mimeType: string;
  size: number;
  category: DocumentCategory;
  year: number | null;
  note: string | null;
  content: Uint8Array<ArrayBuffer>;
};

// Metadata only — never selects the `content` blob, so listing the vault
// stays cheap.
export function getUserDocuments(userId: string) {
  return prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      mimeType: true,
      size: true,
      category: true,
      year: true,
      note: true,
      createdAt: true,
    },
  });
}

export function getDocumentContent(id: string, userId: string) {
  return prisma.document.findFirst({
    where: { id, userId },
    select: { name: true, mimeType: true, content: true },
  });
}

export function createDocument(userId: string, data: DocumentInput) {
  return prisma.document.create({
    data: { ...data, userId },
    select: { id: true },
  });
}

export function deleteDocument(id: string, userId: string) {
  return prisma.document.deleteMany({ where: { id, userId } });
}

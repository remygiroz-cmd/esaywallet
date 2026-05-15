import "server-only";
import { prisma } from "@/lib/prisma";

export function getUserProfiles(userId: string) {
  return prisma.profile.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      isDefault: true,
      createdAt: true,
      _count: { select: { wallets: true, assets: true } },
    },
  });
}

export function createProfile(userId: string, name: string) {
  return prisma.profile.create({
    data: { userId, name, isDefault: false },
  });
}

export function renameProfile(id: string, userId: string, name: string) {
  return prisma.profile.updateMany({ where: { id, userId }, data: { name } });
}

// Refuses to delete the only profile so the account is never left
// data-scoped to a profile that no longer exists.
export async function deleteProfile(
  id: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const count = await prisma.profile.count({ where: { userId } });
  if (count <= 1) {
    return {
      ok: false,
      error: "Impossible de supprimer le seul profil du compte.",
    };
  }
  await prisma.profile.deleteMany({ where: { id, userId } });
  return { ok: true };
}

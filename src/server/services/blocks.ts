import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { badRequest, forbidden, notFound } from "../errors";
import { toUserMini, userMiniSelect } from "./mappers";
import type { UserMini } from "@/lib/types";

/** Users not in a block relation with the viewer (either direction). */
export function notBlockedWith(viewerId: string | null | undefined): Prisma.UserWhereInput {
  if (!viewerId) return {};
  return { blocking: { none: { blockedId: viewerId } }, blockedBy: { none: { blockerId: viewerId } } };
}

export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  return (await db.block.count({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } })) > 0;
}

/** Throws when two users can't interact (follow, comment, like, tag…). */
export async function assertNotBlocked(actorId: string, targetUserId: string) {
  if (await isBlockedEitherWay(actorId, targetUserId)) throw forbidden("No puedes interactuar con este usuario");
}

/** Blocking also removes follows in both directions (and fixes the counters). */
export async function setBlock(blockerId: string, blockedId: string, block: boolean) {
  if (blockerId === blockedId) throw badRequest("No puedes bloquearte a ti mismo");
  const target = await db.user.findUnique({ where: { id: blockedId }, select: { id: true } });
  if (!target) throw notFound("Usuario no encontrado");
  await db.$transaction(async (tx) => {
    if (!block) {
      await tx.block.deleteMany({ where: { blockerId, blockedId } });
      return;
    }
    await tx.block.upsert({ where: { blockerId_blockedId: { blockerId, blockedId } }, create: { blockerId, blockedId }, update: {} });
    for (const [followerId, followingId] of [
      [blockerId, blockedId],
      [blockedId, blockerId],
    ] as const) {
      const { count } = await tx.follow.deleteMany({ where: { followerId, followingId } });
      if (count) {
        await tx.profile.update({ where: { userId: followerId }, data: { followingCount: { decrement: 1 } } });
        await tx.profile.update({ where: { userId: followingId }, data: { followerCount: { decrement: 1 } } });
      }
    }
  });
  return { blocked: block };
}

export async function listBlocked(userId: string): Promise<UserMini[]> {
  const rows = await db.block.findMany({ where: { blockerId: userId }, orderBy: { createdAt: "desc" }, select: { blocked: { select: userMiniSelect } }, take: 500 });
  return rows.map((r) => toUserMini(r.blocked));
}

/** Ids the viewer must not see (blocked by them or blocking them). */
export async function hiddenUserIds(viewerId: string | null | undefined): Promise<string[]> {
  if (!viewerId) return [];
  const rows = await db.block.findMany({ where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] }, select: { blockerId: true, blockedId: true } });
  return [...new Set(rows.map((r) => (r.blockerId === viewerId ? r.blockedId : r.blockerId)))];
}

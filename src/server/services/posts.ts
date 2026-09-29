import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "../db";
import { badRequest, forbidden, notFound } from "../http";
import type { SessionUser } from "../auth/session";
import { nextOffset, parseOffset, photoSelect, toUserMini, userMiniSelect } from "./mappers";
import { notify, notifyMany } from "./notifications";
import { assertNotBlocked, notBlockedWith } from "./blocks";
import type { CommentData, FeedPost, Page } from "@/lib/types";
import type { z } from "zod";
import type { postInputSchema } from "@/lib/validators";
import { isStaff } from "@/lib/roles";

const postSelect = {
  id: true,
  type: true,
  caption: true,
  createdAt: true,
  likeCount: true,
  commentCount: true,
  saveCount: true,
  locationName: true,
  promotionType: true,
  authorId: true,
  author: { select: userMiniSelect },
  photos: { where: { status: "VISIBLE" }, select: photoSelect, orderBy: { position: "asc" } },
  video: { select: { id: true, key: true, posterKey: true, width: true, height: true, status: true } },
  event: { select: { id: true, slug: true, title: true, startsAt: true } },
  venue: { select: { id: true, slug: true, name: true } },
  tags: { select: { user: { select: userMiniSelect } }, take: 10 },
} satisfies Prisma.PostSelect;

type PostRow = Prisma.PostGetPayload<{ select: typeof postSelect }>;

/** Only visible posts whose video (if any) finished processing. */
const visiblePost: Prisma.PostWhereInput = {
  status: "VISIBLE",
  OR: [{ type: { not: "VIDEO" } }, { video: { status: "READY" } }],
  author: { status: "ACTIVE" },
};

/** Visible posts, minus those of users in a block relation with the viewer. */
const visibleFor = (viewerId?: string): Prisma.PostWhereInput => (viewerId ? { AND: [visiblePost, { author: notBlockedWith(viewerId) }] } : visiblePost);

async function hydrate(rows: PostRow[], viewerId?: string): Promise<FeedPost[]> {
  const ids = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const [likes, saves, follows] = viewerId && ids.length
    ? await Promise.all([
        db.like.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } }),
        db.savedPost.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } }),
        db.follow.findMany({ where: { followerId: viewerId, followingId: { in: authorIds } }, select: { followingId: true } }),
      ])
    : [[], [], []];
  const liked = new Set(likes.map((l) => l.postId));
  const saved = new Set(saves.map((s) => s.postId));
  const followed = new Set(follows.map((f) => f.followingId));

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    caption: r.caption,
    createdAt: r.createdAt,
    likeCount: r.likeCount,
    commentCount: r.commentCount,
    saveCount: r.saveCount,
    locationName: r.locationName,
    promotionType: r.promotionType,
    author: toUserMini(r.author),
    photos: r.photos,
    video: r.video && r.video.status === "READY"
      ? { id: r.video.id, key: r.video.key, posterKey: r.video.posterKey, width: r.video.width, height: r.video.height }
      : null,
    event: r.event,
    venue: r.venue,
    tagged: r.tags.map((t) => toUserMini(t.user)),
    viewer: {
      liked: liked.has(r.id),
      saved: saved.has(r.id),
      followsAuthor: followed.has(r.authorId),
      isAuthor: r.authorId === viewerId,
    },
  }));
}

export type FeedMode = "foryou" | "following";

export interface FeedQuery {
  mode: FeedMode;
  viewerId?: string;
  cityId?: string;
  cursor?: string;
  limit?: number;
  /** Optional filter: only videos. */
  videoOnly?: boolean;
}

/**
 * "For you": engagement score with time decay, boosted for the viewer's
 * city and for people they follow. "Following": chronological posts from
 * followed users and followed venues.
 */
export async function getFeed(q: FeedQuery): Promise<Page<FeedPost>> {
  const limit = q.limit ?? 8;
  const offset = parseOffset(q.cursor);

  if (q.mode === "following") {
    if (!q.viewerId) return { items: [], nextCursor: null };
    const rows = await db.post.findMany({
      where: {
        AND: [
          visibleFor(q.viewerId),
          {
            OR: [
              { author: { followers: { some: { followerId: q.viewerId } } } },
              { venue: { followers: { some: { userId: q.viewerId } } } },
            ],
          },
          ...(q.videoOnly ? [{ type: "VIDEO" as const }] : []),
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: postSelect,
      skip: offset,
      take: limit + 1,
    });
    return { items: await hydrate(rows.slice(0, limit), q.viewerId), nextCursor: nextOffset(offset, limit, rows.length) };
  }

  const viewer = q.viewerId ?? "";
  const city = q.cityId ?? "";
  // Parameterised raw SQL (Prisma.sql escapes every interpolated value).
  const ranked = await db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT p.id
    FROM "Post" p
    JOIN "User" u ON u.id = p."authorId" AND u.status = 'ACTIVE'
    LEFT JOIN "Video" v ON v."postId" = p.id
    WHERE p.status = 'VISIBLE'
      AND (p.type <> 'VIDEO' OR v.status = 'READY')
      AND NOT EXISTS (SELECT 1 FROM "Block" b WHERE (b."blockerId" = ${viewer} AND b."blockedId" = p."authorId") OR (b."blockerId" = p."authorId" AND b."blockedId" = ${viewer}))
      ${q.videoOnly ? Prisma.sql`AND p.type = 'VIDEO'` : Prisma.empty}
    ORDER BY (
      (p."likeCount" + 3 * p."commentCount" + 2 * p."saveCount" + 4)
      * (CASE WHEN p."cityId" = ${city} THEN 1.6 ELSE 1 END)
      * (CASE WHEN EXISTS (SELECT 1 FROM "Follow" f WHERE f."followerId" = ${viewer} AND f."followingId" = p."authorId") THEN 2.2 ELSE 1 END)
    ) / POWER(EXTRACT(EPOCH FROM (NOW() - p."createdAt")) / 3600 + 2, 1.35) DESC, p.id DESC
    LIMIT ${limit + 1} OFFSET ${offset}
  `);
  const ids = ranked.slice(0, limit).map((r) => r.id);
  const rows = await db.post.findMany({ where: { id: { in: ids } }, select: postSelect });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter((r): r is PostRow => Boolean(r));
  return { items: await hydrate(ordered, q.viewerId), nextCursor: nextOffset(offset, limit, ranked.length) };
}

export async function getPost(id: string, viewerId?: string): Promise<FeedPost | null> {
  const row = await db.post.findFirst({ where: { AND: [{ id }, visibleFor(viewerId)] }, select: postSelect });
  return row ? (await hydrate([row], viewerId))[0]! : null;
}

interface PostListQuery {
  authorId?: string;
  eventId?: string;
  venueId?: string;
  savedBy?: string;
  taggedUserId?: string;
  viewerId?: string;
  cursor?: string;
  limit?: number;
}

export async function listPosts(q: PostListQuery): Promise<Page<FeedPost>> {
  const limit = q.limit ?? 12;
  const offset = parseOffset(q.cursor);
  const where: Prisma.PostWhereInput = { AND: [visibleFor(q.viewerId)] };
  const and = where.AND as Prisma.PostWhereInput[];
  if (q.authorId) and.push({ authorId: q.authorId });
  if (q.eventId) and.push({ eventId: q.eventId });
  if (q.venueId) and.push({ venueId: q.venueId });
  if (q.savedBy) and.push({ saves: { some: { userId: q.savedBy } } });
  if (q.taggedUserId) and.push({ tags: { some: { userId: q.taggedUserId } } });
  const rows = await db.post.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: postSelect,
    skip: offset,
    take: limit + 1,
  });
  return { items: await hydrate(rows.slice(0, limit), q.viewerId), nextCursor: nextOffset(offset, limit, rows.length) };
}

export async function createPost(user: SessionUser, input: z.infer<typeof postInputSchema>) {
  const [photos, video, event, venue, tagged] = await Promise.all([
    input.photoIds.length
      ? db.photo.findMany({
          where: { id: { in: input.photoIds }, uploaderId: user.id, postId: null, venueId: null, eventId: null },
          select: { id: true },
        })
      : [],
    input.videoId
      ? db.video.findFirst({ where: { id: input.videoId, uploaderId: user.id, postId: null }, select: { id: true, status: true } })
      : null,
    input.eventId
      ? db.event.findFirst({ where: { id: input.eventId, status: "PUBLISHED" }, select: { id: true, cityId: true, venueId: true, locationName: true } })
      : null,
    input.venueId ? db.venue.findFirst({ where: { id: input.venueId, isActive: true }, select: { id: true, cityId: true, name: true } }) : null,
    input.taggedUsernames.length
      ? db.profile.findMany({ where: { username: { in: input.taggedUsernames }, user: { status: "ACTIVE", ...notBlockedWith(user.id) } }, select: { userId: true } })
      : [],
  ]);

  if (photos.length !== input.photoIds.length) throw badRequest("Alguna foto no es válida");
  if (input.videoId && (!video || video.status !== "READY")) throw badRequest("El vídeo no está disponible");
  if (input.eventId && !event) throw badRequest("Evento no válido");
  if (input.venueId && !venue) throw badRequest("Local no válido");

  const type = video ? "VIDEO" : photos.length > 1 ? "CAROUSEL" : "PHOTO";
  const venueId = venue?.id ?? event?.venueId ?? null;
  const cityId = event?.cityId ?? venue?.cityId ?? user.cityId;
  const tagIds = [...new Set(tagged.map((t) => t.userId))].filter((id) => id !== user.id);

  const post = await db.$transaction(async (tx) => {
    const created = await tx.post.create({
      data: {
        authorId: user.id,
        type,
        caption: input.caption ?? null,
        cityId,
        eventId: event?.id ?? null,
        venueId,
        locationName: input.locationName ?? venue?.name ?? event?.locationName ?? null,
        tags: { create: tagIds.map((userId) => ({ userId })) },
      },
      select: { id: true },
    });
    await Promise.all(input.photoIds.map((id, position) => tx.photo.update({ where: { id }, data: { postId: created.id, position } })));
    if (video) await tx.video.update({ where: { id: video.id }, data: { postId: created.id } });
    await tx.profile.update({ where: { userId: user.id }, data: { postCount: { increment: 1 } } });
    return created;
  });

  await notifyMany(tagIds.map((userId) => ({ userId, actorId: user.id, type: "POST_TAG" as const, postId: post.id, dedupeKey: `tag:${post.id}:${userId}` })));
  return post;
}

export async function deletePost(user: SessionUser, postId: string) {
  const post = await db.post.findUnique({ where: { id: postId }, select: { authorId: true, status: true } });
  if (!post) throw notFound("Publicación no encontrada");
  if (post.authorId !== user.id && !isStaff(user.role)) throw forbidden();
  await db.$transaction(async (tx) => {
    await tx.post.update({ where: { id: postId }, data: { status: "REMOVED" } });
    if (post.status !== "REMOVED") {
      await tx.profile.update({ where: { userId: post.authorId }, data: { postCount: { decrement: 1 } } });
    }
  });
}

async function assertVisiblePost(postId: string) {
  const post = await db.post.findFirst({ where: { id: postId, status: "VISIBLE" }, select: { id: true, authorId: true } });
  if (!post) throw notFound("Publicación no encontrada");
  return post;
}

export async function setPostLike(userId: string, postId: string, like: boolean) {
  const post = await assertVisiblePost(postId);
  if (like) await assertNotBlocked(userId, post.authorId);
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.like.findUnique({ where: { userId_postId: { userId, postId } } });
    if (like && !existing) {
      await tx.like.create({ data: { userId, postId } });
      await tx.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } });
    } else if (!like && existing) {
      await tx.like.delete({ where: { id: existing.id } });
      await tx.post.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } });
    }
    const p = await tx.post.findUniqueOrThrow({ where: { id: postId }, select: { likeCount: true } });
    return { liked: like, likeCount: p.likeCount, created: like && !existing };
  });
  if (result.created) {
    await notify({ userId: post.authorId, actorId: userId, type: "POST_LIKE", postId, dedupeKey: `like:${postId}:${userId}` });
  }
  return { liked: result.liked, likeCount: result.likeCount };
}

export async function setPostSaved(userId: string, postId: string, save: boolean) {
  await assertVisiblePost(postId);
  return db.$transaction(async (tx) => {
    const existing = await tx.savedPost.findUnique({ where: { userId_postId: { userId, postId } } });
    if (save && !existing) {
      await tx.savedPost.create({ data: { userId, postId } });
      await tx.post.update({ where: { id: postId }, data: { saveCount: { increment: 1 } } });
    } else if (!save && existing) {
      await tx.savedPost.delete({ where: { userId_postId: { userId, postId } } });
      await tx.post.update({ where: { id: postId }, data: { saveCount: { decrement: 1 } } });
    }
    return { saved: save };
  });
}

export async function listComments(postId: string, viewer: SessionUser | null, cursor?: string, limit = 30): Promise<Page<CommentData>> {
  const offset = parseOffset(cursor);
  const rows = await db.comment.findMany({
    where: { postId, status: "VISIBLE", author: { status: "ACTIVE", ...notBlockedWith(viewer?.id) } },
    orderBy: { createdAt: "asc" },
    select: { id: true, body: true, createdAt: true, authorId: true, author: { select: userMiniSelect }, post: { select: { authorId: true } } },
    skip: offset,
    take: limit + 1,
  });
  return {
    items: rows.slice(0, limit).map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: toUserMini(c.author),
      canDelete: Boolean(viewer && (viewer.id === c.authorId || viewer.id === c.post.authorId || isStaff(viewer.role))),
    })),
    nextCursor: nextOffset(offset, limit, rows.length),
  };
}

const LINK_RE = /(https?:\/\/|www\.)/gi;

export async function addComment(user: SessionUser, postId: string, body: string): Promise<CommentData> {
  const post = await assertVisiblePost(postId);
  await assertNotBlocked(user.id, post.authorId);
  // Basic anti-spam: link-heavy comments and exact repeats are rejected.
  if ((body.match(LINK_RE)?.length ?? 0) > 1) throw badRequest("Demasiados enlaces en el comentario");
  const duplicate = await db.comment.findFirst({
    where: { authorId: user.id, body, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } },
    select: { id: true },
  });
  if (duplicate) throw badRequest("Ya has publicado este comentario");

  const comment = await db.$transaction(async (tx) => {
    const c = await tx.comment.create({
      data: { postId, authorId: user.id, body },
      select: { id: true, body: true, createdAt: true, author: { select: userMiniSelect } },
    });
    await tx.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
    return c;
  });
  await notify({ userId: post.authorId, actorId: user.id, type: "POST_COMMENT", postId, commentId: comment.id });
  return { ...comment, author: toUserMini(comment.author), canDelete: true };
}

export async function deleteComment(user: SessionUser, commentId: string) {
  const c = await db.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true, postId: true, status: true, post: { select: { authorId: true } } },
  });
  if (!c) throw notFound("Comentario no encontrado");
  if (c.authorId !== user.id && c.post.authorId !== user.id && !isStaff(user.role)) throw forbidden();
  await removeComment(commentId);
}

/** Soft-deletes a comment and keeps the post counter in sync. */
export async function removeComment(commentId: string) {
  await db.$transaction(async (tx) => {
    const c = await tx.comment.findUniqueOrThrow({ where: { id: commentId }, select: { status: true, postId: true } });
    if (c.status === "REMOVED") return;
    await tx.comment.update({ where: { id: commentId }, data: { status: "REMOVED" } });
    if (c.status === "VISIBLE") await tx.post.update({ where: { id: c.postId }, data: { commentCount: { decrement: 1 } } });
  });
}

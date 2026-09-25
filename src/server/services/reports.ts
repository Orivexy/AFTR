import "server-only";
import type { Prisma, ReportTargetType } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { badRequest, notFound } from "../http";
import { destroyAllSessions } from "../auth/session";
import { toUserMini, userMiniSelect } from "./mappers";
import { notify } from "./notifications";
import { removeComment } from "./posts";
import type { z } from "zod";
import type { reportSchema } from "@/lib/validators";

type ReportInput = z.infer<typeof reportSchema>;

const FK: Record<ReportTargetType, keyof Prisma.ReportUncheckedCreateInput> = {
  USER: "userId",
  EVENT: "eventId",
  VENUE: "venueId",
  POST: "postId",
  PHOTO: "photoId",
  VIDEO: "videoId",
  COMMENT: "commentId",
};

/** Returns the owner of the reported content (to prevent self-reports and for sanctions). */
async function targetOwner(type: ReportTargetType, id: string): Promise<string | null | undefined> {
  switch (type) {
    case "USER":
      return (await db.user.findUnique({ where: { id }, select: { id: true } }))?.id;
    case "EVENT":
      return (await db.event.findUnique({ where: { id }, select: { organizerId: true } }))?.organizerId;
    case "VENUE":
      return (await db.venue.findUnique({ where: { id }, select: { id: true } })) ? null : undefined;
    case "POST":
      return (await db.post.findUnique({ where: { id }, select: { authorId: true } }))?.authorId;
    case "PHOTO":
      return (await db.photo.findUnique({ where: { id }, select: { uploaderId: true } }))?.uploaderId;
    case "VIDEO":
      return (await db.video.findUnique({ where: { id }, select: { uploaderId: true } }))?.uploaderId;
    case "COMMENT":
      return (await db.comment.findUnique({ where: { id }, select: { authorId: true } }))?.authorId;
  }
}

export async function createReport(reporterId: string, input: ReportInput) {
  const owner = await targetOwner(input.targetType, input.targetId);
  if (owner === undefined) throw notFound("Contenido no encontrado");
  if (owner === reporterId) throw badRequest("No puedes reportar tu propio contenido");

  const targetKey = `${input.targetType}:${input.targetId}`;
  const existing = await db.report.findUnique({ where: { reporterId_targetKey: { reporterId, targetKey } } });
  if (existing) return { alreadyReported: true };

  await db.report.create({
    data: {
      reporterId,
      targetType: input.targetType,
      targetKey,
      [FK[input.targetType]]: input.targetId,
      reason: input.reason,
      details: input.details ?? null,
    },
  });

  // Enough distinct reporters → hide the content until a moderator reviews it.
  const openReports = await db.report.count({ where: { targetKey, status: "OPEN" } });
  if (openReports >= env.AUTO_HIDE_REPORT_THRESHOLD) await setContentVisibility(input.targetType, input.targetId, "HIDDEN");
  return { alreadyReported: false };
}

type Visibility = "VISIBLE" | "HIDDEN" | "REMOVED";

/** Applies a visibility state to any reportable content type. */
export async function setContentVisibility(type: ReportTargetType, id: string, status: Visibility) {
  switch (type) {
    case "POST": {
      const post = await db.post.findUnique({ where: { id }, select: { status: true, authorId: true } });
      if (!post || post.status === status) return;
      const delta = (status === "VISIBLE" ? 1 : 0) - (post.status === "VISIBLE" ? 1 : 0);
      await db.$transaction([
        db.post.update({ where: { id }, data: { status } }),
        ...(delta ? [db.profile.update({ where: { userId: post.authorId }, data: { postCount: { increment: delta } } })] : []),
      ]);
      return;
    }
    case "PHOTO":
      await db.photo.update({ where: { id }, data: { status } });
      return;
    case "VIDEO": {
      const video = await db.video.findUnique({ where: { id }, select: { postId: true } });
      if (video?.postId) await setContentVisibility("POST", video.postId, status);
      return;
    }
    case "COMMENT": {
      if (status === "REMOVED") return removeComment(id);
      const c = await db.comment.findUnique({ where: { id }, select: { status: true, postId: true } });
      if (!c || c.status === status || c.status === "REMOVED") return;
      await db.$transaction([
        db.comment.update({ where: { id }, data: { status } }),
        db.post.update({ where: { id: c.postId }, data: { commentCount: { increment: status === "VISIBLE" ? 1 : -1 } } }),
      ]);
      return;
    }
    case "EVENT":
      if (status !== "VISIBLE") await db.event.update({ where: { id }, data: { status: status === "HIDDEN" ? "PENDING" : "REJECTED" } });
      else await db.event.update({ where: { id }, data: { status: "PUBLISHED" } });
      return;
    case "VENUE":
      await db.venue.update({ where: { id }, data: { isActive: status === "VISIBLE" } });
      return;
    case "USER":
      // Users aren't auto-hidden; moderators suspend them explicitly.
      return;
  }
}

export async function setUserSuspended(userId: string, suspended: boolean) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) throw notFound("Usuario no encontrado");
  if (user.role === "ADMIN" && suspended) throw badRequest("No se puede suspender a un administrador");
  await db.user.update({
    where: { id: userId },
    data: { status: suspended ? "SUSPENDED" : "ACTIVE", suspendedAt: suspended ? new Date() : null },
  });
  if (suspended) await destroyAllSessions(userId);
}

export type ReportAction = "dismiss" | "remove" | "restore" | "suspend";

/** Resolves every open report on the same target at once. */
export async function resolveReport(reportId: string, moderatorId: string, action: ReportAction, note?: string) {
  const report = await db.report.findUnique({ where: { id: reportId } });
  if (!report) throw notFound("Reporte no encontrado");
  const [, targetId] = report.targetKey.split(":") as [string, string];

  if (action === "remove" || action === "restore") {
    await setContentVisibility(report.targetType, targetId, action === "remove" ? "REMOVED" : "VISIBLE");
    if (action === "remove") {
      const owner = await targetOwner(report.targetType, targetId);
      if (owner) await notify({ userId: owner, type: "CONTENT_REMOVED" });
    }
  }
  if (action === "suspend") {
    const owner = report.targetType === "USER" ? targetId : await targetOwner(report.targetType, targetId);
    if (owner) await setUserSuspended(owner, true);
    if (report.targetType !== "USER") await setContentVisibility(report.targetType, targetId, "REMOVED");
  }
  if (action === "dismiss") {
    // False alarm: restore anything that was auto-hidden.
    await setContentVisibility(report.targetType, targetId, "VISIBLE").catch(() => {});
  }

  await db.report.updateMany({
    where: { targetKey: report.targetKey, status: "OPEN" },
    data: {
      status: action === "dismiss" || action === "restore" ? "DISMISSED" : "RESOLVED",
      resolvedById: moderatorId,
      resolvedAt: new Date(),
      resolution: note ? `${action}: ${note}` : action,
    },
  });
}

export async function listReports(status: "OPEN" | "RESOLVED" | "DISMISSED", cursor?: string, limit = 30) {
  const rows = await db.report.findMany({
    where: { status },
    orderBy: { createdAt: status === "OPEN" ? "asc" : "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      targetType: true,
      targetKey: true,
      reason: true,
      details: true,
      status: true,
      createdAt: true,
      resolution: true,
      reporter: { select: userMiniSelect },
      user: { select: userMiniSelect },
      event: { select: { slug: true, title: true, status: true } },
      venue: { select: { slug: true, name: true, isActive: true } },
      post: { select: { id: true, caption: true, status: true, author: { select: userMiniSelect } } },
      photo: { select: { key: true, status: true, uploader: { select: userMiniSelect } } },
      video: { select: { posterKey: true, postId: true } },
      comment: { select: { body: true, status: true, postId: true, author: { select: userMiniSelect } } },
    },
  });
  const counts = await db.report.groupBy({
    by: ["targetKey"],
    where: { targetKey: { in: rows.map((r) => r.targetKey) }, status: "OPEN" },
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.targetKey, c._count._all]));
  const items = rows.slice(0, limit).map((r) => ({
    ...r,
    reporter: toUserMini(r.reporter),
    user: r.user ? toUserMini(r.user) : null,
    post: r.post ? { ...r.post, author: toUserMini(r.post.author) } : null,
    photo: r.photo ? { ...r.photo, uploader: toUserMini(r.photo.uploader) } : null,
    comment: r.comment ? { ...r.comment, author: toUserMini(r.comment.author) } : null,
    openReportsOnTarget: countMap.get(r.targetKey) ?? 0,
  }));
  return { items, nextCursor: rows.length > limit ? items[items.length - 1]!.id : null };
}

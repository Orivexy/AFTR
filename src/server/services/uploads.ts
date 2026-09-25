import "server-only";
import { db } from "../db";
import { env } from "../env";
import { badRequest } from "../http";
import { processImage, deleteImage } from "../media/image";
import { processVideo } from "../media/video";
import { storage } from "../storage";
import { imageUrl } from "@/lib/media";

const MB = 1024 * 1024;

export type UploadKind = "image" | "avatar" | "video";

/**
 * Stores an uploaded file as a pending (unattached) Photo or Video owned by
 * the uploader. Posts / events / galleries later claim it by id, which is
 * checked against the uploader, so nobody can attach someone else's media.
 */
export async function handleUpload(userId: string, file: File, kind: UploadKind) {
  if (kind === "video") {
    if (file.size > env.MAX_VIDEO_MB * MB) throw badRequest(`El vídeo supera ${env.MAX_VIDEO_MB} MB`);
    const stored = await processVideo(Buffer.from(await file.arrayBuffer()));
    const video = await db.video.create({
      data: { uploaderId: userId, ...stored, status: "READY" },
      select: { id: true, key: true, posterKey: true, width: true, height: true, durationSec: true },
    });
    return { kind: "video" as const, ...video, posterUrl: imageUrl(video.posterKey, "sm") };
  }

  if (file.size > env.MAX_IMAGE_MB * MB) throw badRequest(`La imagen supera ${env.MAX_IMAGE_MB} MB`);
  const stored = await processImage(Buffer.from(await file.arrayBuffer()), { square: kind === "avatar" });
  const photo = await db.photo.create({
    data: { uploaderId: userId, ...stored },
    select: { id: true, key: true, width: true, height: true, blurDataUrl: true },
  });
  return { kind: "image" as const, ...photo, url: imageUrl(photo.key, "sm") };
}

/**
 * Deletes uploads that were never attached (abandoned forms) after 24 h.
 * Keys still used as avatar / cover are kept.
 */
export async function cleanupOrphanUploads() {
  const cutoff = new Date(Date.now() - 24 * 3600_000);
  const photos = await db.photo.findMany({
    where: { createdAt: { lt: cutoff }, postId: null, venueId: null, eventId: null },
    select: { id: true, key: true },
    take: 500,
  });
  const keys = photos.map((p) => p.key);
  const [avatars, covers, venueCovers, posters] = await Promise.all([
    db.profile.findMany({ where: { avatarKey: { in: keys } }, select: { avatarKey: true } }),
    db.event.findMany({ where: { coverKey: { in: keys } }, select: { coverKey: true } }),
    db.venue.findMany({ where: { coverKey: { in: keys } }, select: { coverKey: true } }),
    db.video.findMany({ where: { posterKey: { in: keys } }, select: { posterKey: true } }),
  ]);
  const inUse = new Set([...avatars.map((a) => a.avatarKey), ...covers.map((c) => c.coverKey), ...venueCovers.map((c) => c.coverKey), ...posters.map((p) => p.posterKey)]);
  const orphans = photos.filter((p) => !inUse.has(p.key));
  for (const p of orphans) await deleteImage(p.key);
  await db.photo.deleteMany({ where: { id: { in: orphans.map((p) => p.id) } } });

  const videos = await db.video.findMany({ where: { createdAt: { lt: cutoff }, postId: null }, select: { id: true, key: true, posterKey: true }, take: 200 });
  for (const v of videos) {
    await storage.delete([v.key]);
    if (v.posterKey) await deleteImage(v.posterKey);
  }
  await db.video.deleteMany({ where: { id: { in: videos.map((v) => v.id) } } });
  return { photos: orphans.length, videos: videos.length };
}

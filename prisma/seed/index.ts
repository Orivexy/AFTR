/**
 * Demo seed. Run with `npm run db:seed` (or `npm run db:reset`).
 *
 * Wipes the database and local storage, then creates cities, taxonomy and a
 * fictional Barcelona nightlife scene (plus a few venues in other cities)
 * with events relative to *today*, so "Hoy" always has content.
 * All generated content is flagged `isDemo` and labelled as such in the UI.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";
import { CITIES, COUNTRIES } from "../../src/config/cities";
import { CATEGORIES, GENRES } from "../../src/config/taxonomy";
import { buildSearchText } from "../../src/lib/text";
import { localToUtc, nightWindow, utcToLocalParts } from "../../src/lib/time";
import { processImage } from "../../src/server/media/image";
import { processVideo } from "../../src/server/media/video";
import { renderArt, renderAvatar } from "./art";
import { createRandom } from "./random";
import {
  COMMENTS, DJS, POST_CAPTIONS, REVIEW_COMMENTS, STREET_EVENTS, USERS, VENUE_NIGHT_TITLES, VENUES, VIDEO_CAPTIONS,
} from "./data";

const db = new PrismaClient();
const r = createRandom(20260925);
const run = promisify(execFile);
const TZ = "Europe/Madrid";
const PASSWORD = process.env.SEED_PASSWORD || "nightly123";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const log = (msg: string) => console.log(`  • ${msg}`);

async function wipe() {
  // Order matters only for tables without cascading FKs.
  await db.$transaction([
    db.notification.deleteMany(),
    db.report.deleteMany(),
    db.like.deleteMany(),
    db.comment.deleteMany(),
    db.savedPost.deleteMany(),
    db.postTag.deleteMany(),
    db.video.deleteMany(),
    db.photo.deleteMany(),
    db.post.deleteMany(),
    db.review.deleteMany(),
    db.savedEvent.deleteMany(),
    db.eventAttendance.deleteMany(),
    db.eventGenre.deleteMany(),
    db.event.deleteMany(),
    db.venueFollow.deleteMany(),
    db.venueGenre.deleteMany(),
    db.venue.deleteMany(),
    db.follow.deleteMany(),
    db.session.deleteMany(),
    db.account.deleteMany(),
    db.profile.deleteMany(),
    db.user.deleteMany(),
    db.category.deleteMany(),
    db.musicGenre.deleteMany(),
    db.city.deleteMany(),
    db.country.deleteMany(),
  ]);
  const dir = path.resolve(process.env.STORAGE_LOCAL_DIR || "./storage");
  await rm(path.join(dir, "img"), { recursive: true, force: true });
  await rm(path.join(dir, "vid"), { recursive: true, force: true });
}

async function image(seed: string, width: number, height: number, opts: { crowd?: boolean; square?: boolean } = {}) {
  return processImage(await renderArt({ width, height, seed, crowd: opts.crowd }), { square: opts.square });
}

/** Short vertical clip: slow zoom over generated artwork with pulsing "strobe" light. */
async function demoVideo(seed: string) {
  const req = createRequire(import.meta.url);
  let ffmpeg: string;
  try {
    ffmpeg = (req("@ffmpeg-installer/ffmpeg") as { path: string }).path;
  } catch {
    return null;
  }
  const dir = await mkdtemp(path.join(tmpdir(), "nightly-seed-"));
  try {
    const still = path.join(dir, "still.jpg");
    const out = path.join(dir, "clip.mp4");
    await writeFile(still, await renderArt({ width: 1080, height: 1920, seed }));
    const speed = r.float(1.5, 3).toFixed(2);
    await run(ffmpeg, [
      "-y", "-loop", "1", "-i", still, "-t", "7",
      "-vf",
      `zoompan=z='min(zoom+0.0009,1.2)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=210:s=540x960:fps=30,` +
        `hue=h='20*sin(2*PI*t/7)',eq=brightness='0.07*sin(2*PI*t*${speed})':eval=frame`,
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", out,
    ]);
    return processVideo(await readFile(out));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function hoursFor(v: (typeof VENUES)[number]) {
  const hours: Record<string, Array<{ open: string; close: string }>> = {};
  for (const d of v.days) hours[d] = [{ open: v.open, close: v.close }];
  return hours;
}

async function main() {
  console.log("🌙 Seeding demo data…");
  await wipe();

  // ─── Geography & taxonomy ────────────────────────────────────────────────
  const countries = new Map<string, string>();
  for (const c of COUNTRIES) countries.set(c.code, (await db.country.create({ data: c })).id);
  const cities = new Map<string, { id: string; name: string }>();
  for (const c of CITIES) {
    const city = await db.city.create({
      data: { slug: c.slug, name: c.name, countryId: countries.get(c.countryCode)!, lat: c.lat, lng: c.lng, timezone: c.timezone },
    });
    cities.set(c.slug, { id: city.id, name: city.name });
  }
  const categories = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) categories.set(c.slug, (await db.category.create({ data: { ...c, order: i } })).id);
  const genres = new Map<string, string>();
  for (const [i, g] of GENRES.entries()) genres.set(g.slug, (await db.musicGenre.create({ data: { ...g, order: i } })).id);
  log(`${cities.size} ciudades, ${categories.size} categorías, ${genres.size} géneros`);

  // ─── Users ───────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const bcn = cities.get("barcelona")!;

  async function createUser(u: { email: string; username: string; displayName: string; bio?: string; role?: "USER" | "ADMIN" | "MODERATOR"; avatar?: boolean; daysAgo?: number }) {
    const avatar = u.avatar === false ? null : await processImage(await renderAvatar(u.username), { square: true });
    return db.user.create({
      data: {
        email: u.email,
        passwordHash,
        role: u.role ?? "USER",
        emailVerified: new Date(),
        createdAt: new Date(Date.now() - (u.daysAgo ?? r.int(30, 400)) * 86400_000),
        profile: {
          create: {
            username: u.username,
            displayName: u.displayName,
            bio: u.bio,
            avatarKey: avatar?.key,
            cityId: bcn.id,
            isDemo: true,
            searchText: buildSearchText(u.username, u.displayName),
          },
        },
      },
      select: { id: true, profile: { select: { username: true } } },
    });
  }

  const admin = await createUser({ email: "admin@nightly.demo", username: "nightly", displayName: "NIGHTLY Team", bio: "Cuenta oficial (demo)", role: "ADMIN" });
  const users = [];
  for (const u of USERS) users.push(await createUser({ email: `${u.username.replace(/\./g, "")}@nightly.demo`, ...u }));
  const demoUser = users[0]!; // "eric"
  log(`${users.length + 1} usuarios (contraseña demo: ${PASSWORD})`);

  // ─── Venues (each with a manager account) ────────────────────────────────
  const venues: Array<{ id: string; slug: string; name: string; cityId: string; genres: string[]; managerId: string; lat: number; lng: number; address: string; neighborhood: string; priceMin: number; priceMax: number; days: string[]; open: string; close: string; city: string }> = [];
  for (const v of VENUES) {
    const city = cities.get(v.city)!;
    const manager = await createUser({
      email: `${v.slug}@venues.nightly.demo`,
      username: v.slug.replace(/-/g, "_").slice(0, 24),
      displayName: v.name,
      bio: `Cuenta del local ${v.name} (demo)`,
    });
    const cover = await image(`venue-${v.slug}`, 1280, 853);
    const venue = await db.venue.create({
      data: {
        slug: v.slug,
        name: v.name,
        type: v.type,
        description: v.description,
        cityId: city.id,
        address: v.address,
        neighborhood: v.neighborhood,
        lat: v.lat,
        lng: v.lng,
        coverKey: cover.key,
        openingHours: hoursFor(v),
        priceMin: v.priceMin * 100,
        priceMax: v.priceMax * 100,
        minAge: v.minAge,
        instagram: `@${v.slug.replace(/-/g, "")}`,
        isFeatured: Boolean(v.featured),
        isDemo: true,
        searchText: buildSearchText(v.name, v.neighborhood, v.address, city.name, v.genres.join(" ")),
        genres: { create: v.genres.map((g) => ({ genreId: genres.get(g)! })) },
        managers: { connect: { id: manager.id } },
      },
    });
    await db.photo.create({ data: { uploaderId: manager.id, venueId: venue.id, ...cover } });
    venues.push({ ...v, id: venue.id, cityId: city.id, managerId: manager.id });
  }
  log(`${venues.length} locales`);

  // ─── Events ──────────────────────────────────────────────────────────────
  const tonight = nightWindow(TZ, 0).from; // 06:00 local of the current night
  const localDate = (dayOffset: number) => utcToLocalParts(new Date(tonight.getTime() + dayOffset * 86400_000 + 12 * 3600_000), TZ).date;
  const at = (dayOffset: number, time: string) => {
    const [h] = time.split(":").map(Number);
    // Times before 06:00 belong to the next calendar day of the same night.
    return localToUtc(localDate(h! < 6 ? dayOffset + 1 : dayOffset), time, TZ);
  };
  const eventRows: Array<{ id: string; startsAt: Date; venueId: string | null; cityId: string; title: string }> = [];

  async function createEvent(e: {
    title: string; description: string; category: string; cityId: string; cityName: string; venueId?: string; organizerId: string;
    locationName: string; address: string; neighborhood?: string; lat: number; lng: number; startsAt: Date; endsAt: Date; price: number; priceMax?: number;
    genres: string[]; featured?: boolean; minAge?: number; source: "USER" | "VENUE";
  }) {
    const cover = await image(`event-${e.title}-${e.startsAt.toISOString()}`, 1280, 853);
    const created = await db.event.create({
      data: {
        slug: `${e.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${r.int(1000, 9999)}`,
        title: e.title,
        description: e.description,
        categoryId: categories.get(e.category)!,
        cityId: e.cityId,
        venueId: e.venueId,
        organizerId: e.organizerId,
        locationName: e.locationName,
        address: e.address,
        lat: e.lat,
        lng: e.lng,
        startsAt: e.startsAt,
        endsAt: e.endsAt > e.startsAt ? e.endsAt : new Date(e.endsAt.getTime() + 86400_000),
        priceMin: e.price * 100,
        priceMax: e.priceMax ? e.priceMax * 100 : null,
        minAge: e.minAge,
        coverKey: cover.key,
        isFeatured: Boolean(e.featured),
        isDemo: true,
        source: e.source,
        status: "PUBLISHED",
        searchText: buildSearchText(e.title, e.locationName, e.neighborhood, e.address, e.cityName, e.genres.join(" ")),
        genres: { create: e.genres.map((g) => ({ genreId: genres.get(g)! })) },
      },
    });
    await db.photo.create({ data: { uploaderId: e.organizerId, eventId: created.id, ...cover } });
    eventRows.push({ id: created.id, startsAt: e.startsAt, venueId: e.venueId ?? null, cityId: e.cityId, title: e.title });
    return created;
  }

  // Street parties / FM / open-air (organised by regular users)
  for (const s of STREET_EVENTS) {
    const city = cities.get(s.city)!;
    await createEvent({
      title: s.title, description: s.description, category: s.category, cityId: city.id, cityName: city.name,
      organizerId: r.pick(users).id, locationName: s.locationName, address: s.address, lat: s.lat, lng: s.lng,
      startsAt: at(s.day, s.start), endsAt: at(s.day, s.end), price: s.price, genres: s.genres, featured: s.featured, source: "USER",
    });
  }

  // Venue nights: every opening day over the next 3 weeks (+ yesterday for posts).
  const anchorDow = new Date(tonight.getTime() + 12 * 3600_000).getUTCDay();
  for (const v of venues) {
    const isBcn = v.city === "barcelona";
    let count = 0;
    for (let day = -1; day <= 20; day++) {
      const dow = DAY_KEYS[(anchorDow + day + 7 * 4) % 7]!;
      if (!v.days.includes(dow)) continue;
      // Not every opening night is a named event.
      const keep = day <= 1 || (dow === "fri" || dow === "sat" ? r.chance(isBcn ? 0.6 : 0.35) : r.chance(0.15));
      if (!keep) continue;
      if (!isBcn && count >= 3) break;
      const genre = r.pick(v.genres);
      const base = r.pick(VENUE_NIGHT_TITLES[genre] ?? VENUE_NIGHT_TITLES.comercial!);
      const title = v.slug === "sala-x" && day === 0 ? "NIGHT SESSION" : r.chance(0.3) ? `${base} · ${r.pick(DJS)}` : base;
      const price = v.priceMin === 0 ? r.pick([0, 0, 5, 8]) : r.pick([v.priceMin, v.priceMin, Math.round((v.priceMin + v.priceMax) / 2)]);
      await createEvent({
        title,
        description: `${title} en ${v.name}. ${genre === "techno" ? "Sesión larga, sonido envolvente y luces al mínimo." : "Pista llena, buena música y el mejor ambiente de la ciudad."} (Evento de demostración: no es un evento real.)`,
        category: r.chance(0.3) ? "dj" : "discoteca",
        cityId: v.cityId, cityName: cities.get(v.city)!.name, venueId: v.id, organizerId: v.managerId,
        locationName: v.name, address: v.address, neighborhood: v.neighborhood, lat: v.lat, lng: v.lng,
        startsAt: at(day, v.slug === "sala-x" && day === 0 ? "00:00" : v.open), endsAt: at(day, v.close),
        price: v.slug === "sala-x" && day === 0 ? 15 : price, priceMax: price > 0 && r.chance(0.4) ? price + 5 : undefined,
        genres: v.genres.slice(0, 2), featured: day >= 0 && day <= 3 && r.chance(0.12), minAge: 18, source: "VENUE",
      });
      count++;
    }
  }
  log(`${eventRows.length} eventos`);

  // ─── Social graph ────────────────────────────────────────────────────────
  const people = users;
  const follows: Prisma.FollowCreateManyInput[] = [];
  for (const u of people) {
    for (const other of r.sample(people.filter((p) => p.id !== u.id), r.int(4, 14))) {
      follows.push({ followerId: u.id, followingId: other.id, createdAt: new Date(Date.now() - r.int(1, 90) * 86400_000) });
    }
  }
  await db.follow.createMany({ data: follows, skipDuplicates: true });
  const venueFollows: Prisma.VenueFollowCreateManyInput[] = [];
  for (const u of people) for (const v of r.sample(venues.filter((v) => v.city === "barcelona"), r.int(2, 7))) venueFollows.push({ userId: u.id, venueId: v.id });
  await db.venueFollow.createMany({ data: venueFollows, skipDuplicates: true });
  log(`${follows.length} follows, ${venueFollows.length} seguidores de locales`);

  // ─── Attendance & saved ──────────────────────────────────────────────────
  const upcoming = eventRows.filter((e) => e.startsAt > new Date(Date.now() - 6 * 3600_000));
  const attendance: Prisma.EventAttendanceCreateManyInput[] = [];
  for (const e of upcoming) {
    for (const u of r.sample(people, r.int(0, 14))) attendance.push({ userId: u.id, eventId: e.id, status: r.chance(0.55) ? "GOING" : "INTERESTED" });
  }
  await db.eventAttendance.createMany({ data: attendance, skipDuplicates: true });
  await db.savedEvent.createMany({ data: r.sample(upcoming, 5).map((e) => ({ userId: demoUser.id, eventId: e.id })), skipDuplicates: true });

  // ─── Reviews ─────────────────────────────────────────────────────────────
  let reviewCount = 0;
  for (const v of venues) {
    const base = r.float(3.4, 4.7);
    for (const u of r.sample(people, v.city === "barcelona" ? r.int(8, 20) : r.int(2, 5))) {
      const around = () => Math.max(1, Math.min(5, Math.round(base + r.float(-1.3, 1.1))));
      await db.review.create({
        data: {
          userId: u.id, venueId: v.id, rating: around(), ambience: around(), music: around(),
          staff: r.chance(0.8) ? around() : null, price: r.chance(0.8) ? around() : null, space: r.chance(0.7) ? around() : null,
          comment: r.chance(0.65) ? r.pick(REVIEW_COMMENTS) : null,
          ...(() => {
            const at = new Date(Date.now() - r.int(1, 200) * 86400_000);
            return { createdAt: at, updatedAt: at };
          })(),
        },
      });
      reviewCount++;
    }
  }
  log(`${reviewCount} valoraciones`);

  // ─── Venue community photos ──────────────────────────────────────────────
  let photoCount = 0;
  for (const v of venues.filter((v) => v.city === "barcelona")) {
    for (let i = 0; i < r.int(3, 6); i++) {
      const author = r.pick(people);
      const img = await image(`community-${v.slug}-${i}`, 1080, 1350);
      await db.photo.create({
        data: { uploaderId: author.id, venueId: v.id, ...img, likeCount: 0, createdAt: new Date(Date.now() - r.int(1, 60) * 86400_000) },
      });
      photoCount++;
    }
  }
  log(`${photoCount} fotos de la comunidad`);

  // ─── Posts ───────────────────────────────────────────────────────────────
  const recentEvents = eventRows.filter((e) => e.startsAt < new Date() && e.cityId === bcn.id);
  const bcnVenues = venues.filter((v) => v.city === "barcelona");
  const postIds: string[] = [];
  const postCount = 30;
  const videoSlots = new Set(r.sample([...Array(postCount).keys()], 8));
  let videoIdx = 0;
  for (let i = 0; i < postCount; i++) {
    const author = i < 3 ? demoUser : r.pick(people);
    const event = recentEvents.length && r.chance(0.5) ? r.pick(recentEvents) : null;
    const venue = event?.venueId ? bcnVenues.find((v) => v.id === event.venueId) : r.chance(0.6) ? r.pick(bcnVenues) : null;
    const createdAt = new Date(Date.now() - r.int(20, 5 * 24 * 60) * 60_000);
    const isVideo = videoSlots.has(i);

    let videoId: string | null = null;
    if (isVideo) {
      const v = await demoVideo(`video-${i}`);
      if (v) videoId = (await db.video.create({ data: { uploaderId: author.id, ...v, status: "READY" } })).id;
    }
    const photos = videoId ? [] : await Promise.all([...Array(r.chance(0.35) ? r.int(2, 4) : 1).keys()].map((k) => image(`post-${i}-${k}`, 1080, 1350)));

    const post = await db.post.create({
      data: {
        authorId: author.id,
        type: videoId ? "VIDEO" : photos.length > 1 ? "CAROUSEL" : "PHOTO",
        caption: videoId ? VIDEO_CAPTIONS[videoIdx++ % VIDEO_CAPTIONS.length] : r.pick(POST_CAPTIONS),
        cityId: bcn.id,
        eventId: event?.id,
        venueId: venue?.id,
        locationName: venue?.name ?? (event ? event.title : null),
        isDemo: true,
        createdAt,
        photos: { create: photos.map((p, position) => ({ ...p, uploaderId: author.id, position, createdAt })) },
      },
    });
    if (videoId) await db.video.update({ where: { id: videoId }, data: { postId: post.id } });
    postIds.push(post.id);
  }
  log(`${postIds.length} publicaciones (${videoIdx} vídeos)`);

  // Likes, comments, saves
  const likes: Prisma.LikeCreateManyInput[] = [];
  for (const postId of postIds) for (const u of r.sample(people, r.int(2, 20))) likes.push({ userId: u.id, postId });
  const photos = await db.photo.findMany({ where: { venueId: { not: null }, postId: null }, select: { id: true } });
  for (const p of photos) for (const u of r.sample(people, r.int(0, 8))) likes.push({ userId: u.id, photoId: p.id });
  await db.like.createMany({ data: likes, skipDuplicates: true });
  const comments: Prisma.CommentCreateManyInput[] = [];
  for (const postId of postIds) {
    for (let k = 0; k < r.int(0, 6); k++) comments.push({ postId, authorId: r.pick(people).id, body: r.pick(COMMENTS), createdAt: new Date(Date.now() - r.int(5, 3000) * 60_000) });
  }
  await db.comment.createMany({ data: comments });
  await db.savedPost.createMany({ data: r.sample(postIds, 4).map((postId) => ({ userId: demoUser.id, postId })), skipDuplicates: true });
  log(`${likes.length} likes, ${comments.length} comentarios`);

  // Notifications for the demo account (so the inbox isn't empty)
  const demoPosts = await db.post.findMany({ where: { authorId: demoUser.id }, select: { id: true } });
  const notifs: Prisma.NotificationCreateManyInput[] = [];
  for (const f of await db.follow.findMany({ where: { followingId: demoUser.id }, take: 4 })) {
    notifs.push({ userId: demoUser.id, actorId: f.followerId, type: "FOLLOW", createdAt: new Date(Date.now() - r.int(10, 2000) * 60_000) });
  }
  for (const l of await db.like.findMany({ where: { postId: { in: demoPosts.map((p) => p.id) } }, take: 5 })) {
    notifs.push({ userId: demoUser.id, actorId: l.userId, type: "POST_LIKE", postId: l.postId, createdAt: new Date(Date.now() - r.int(10, 2000) * 60_000) });
  }
  for (const c of await db.comment.findMany({ where: { postId: { in: demoPosts.map((p) => p.id) } }, take: 3 })) {
    notifs.push({ userId: demoUser.id, actorId: c.authorId, type: "POST_COMMENT", postId: c.postId, commentId: c.id, createdAt: c.createdAt });
  }
  await db.notification.createMany({ data: notifs.filter((n) => n.actorId !== demoUser.id) });

  // ─── Denormalised counters ───────────────────────────────────────────────
  await recount();
  console.log(`✅ Listo. Entra con eric@nightly.demo o admin@nightly.demo · contraseña: ${PASSWORD}`);
}

/** Recomputes every cached counter from the source tables. */
async function recount() {
  await db.$executeRawUnsafe(`
    UPDATE "Post" p SET
      "likeCount" = (SELECT COUNT(*) FROM "Like" l WHERE l."postId" = p.id),
      "commentCount" = (SELECT COUNT(*) FROM "Comment" c WHERE c."postId" = p.id AND c.status = 'VISIBLE'),
      "saveCount" = (SELECT COUNT(*) FROM "SavedPost" s WHERE s."postId" = p.id)`);
  await db.$executeRawUnsafe(`UPDATE "Photo" ph SET "likeCount" = (SELECT COUNT(*) FROM "Like" l WHERE l."photoId" = ph.id)`);
  await db.$executeRawUnsafe(`
    UPDATE "Event" e SET
      "goingCount" = (SELECT COUNT(*) FROM "EventAttendance" a WHERE a."eventId" = e.id AND a.status = 'GOING'),
      "interestedCount" = (SELECT COUNT(*) FROM "EventAttendance" a WHERE a."eventId" = e.id AND a.status = 'INTERESTED')`);
  await db.$executeRawUnsafe(`
    UPDATE "Venue" v SET
      "ratingAvg" = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 2) FROM "Review" r WHERE r."venueId" = v.id AND NOT r."isHidden"), 0),
      "ratingCount" = (SELECT COUNT(*) FROM "Review" r WHERE r."venueId" = v.id AND NOT r."isHidden"),
      "followerCount" = (SELECT COUNT(*) FROM "VenueFollow" f WHERE f."venueId" = v.id)`);
  await db.$executeRawUnsafe(`
    UPDATE "Profile" pr SET
      "followerCount" = (SELECT COUNT(*) FROM "Follow" f WHERE f."followingId" = pr."userId"),
      "followingCount" = (SELECT COUNT(*) FROM "Follow" f WHERE f."followerId" = pr."userId"),
      "postCount" = (SELECT COUNT(*) FROM "Post" p WHERE p."authorId" = pr."userId" AND p.status = 'VISIBLE')`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

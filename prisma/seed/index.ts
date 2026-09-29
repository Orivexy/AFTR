/**
 * Base data. Run with `npm run db:seed` (also after `prisma migrate deploy`
 * in production). Idempotent and non-destructive: it only upserts
 * configuration — never content. ORIVEXY NIGHTS's venues and events come from the
 * configured sources (VENUE_SYNC / EVENT_SYNC) and from its users.
 *
 *  - countries, cities, categories and music genres (src/config)
 *  - business plan catalogue (inactive while monetization is off)
 *  - discovery sources: OpenStreetMap per city (enabled for Barcelona; no
 *    key needed), Ticketmaster and Google Places (disabled until keys exist)
 *  - optional first admin: ADMIN_EMAIL + ADMIN_PASSWORD (+ ADMIN_USERNAME)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CITIES, COUNTRIES } from "../../src/config/cities";
import { CATEGORIES, GENRES } from "../../src/config/taxonomy";
import { buildSearchText } from "../../src/lib/text";

const db = new PrismaClient();
const log = (msg: string) => console.log(`  • ${msg}`);

/** Cities where venue discovery starts enabled. */
const ENABLED_CITIES = new Set((process.env.SEED_DISCOVERY_CITIES ?? "barcelona").split(",").map((s) => s.trim()).filter(Boolean));

async function main() {
  console.log("🌙 ORIVEXY NIGHTS · datos base");

  for (const c of COUNTRIES) await db.country.upsert({ where: { code: c.code }, create: c, update: { name: c.name, currency: c.currency } });
  const countries = new Map((await db.country.findMany()).map((c) => [c.code, c.id]));
  for (const c of CITIES) {
    const data = { name: c.name, countryId: countries.get(c.countryCode)!, lat: c.lat, lng: c.lng, timezone: c.timezone };
    await db.city.upsert({ where: { slug: c.slug }, create: { slug: c.slug, ...data }, update: data });
  }
  for (const [order, c] of CATEGORIES.entries()) await db.category.upsert({ where: { slug: c.slug }, create: { ...c, order }, update: { name: c.name, emoji: c.emoji, order } });
  for (const [order, g] of GENRES.entries()) await db.musicGenre.upsert({ where: { slug: g.slug }, create: { ...g, order }, update: { name: g.name, order } });
  log(`${CITIES.length} ciudades · ${CATEGORIES.length} categorías · ${GENRES.length} géneros`);

  const plans = [
    { code: "PLAN_FREE" as const, name: "Free", description: "Perfil y eventos básicos", features: [] },
    { code: "PLAN_PREMIUM" as const, name: "Premium", description: "Destacar eventos y perfil, estadísticas", features: ["featured_events", "featured_profile", "stats"] },
    { code: "PLAN_BUSINESS" as const, name: "Business", description: "Todo Premium + mayor visibilidad y herramientas", features: ["featured_events", "featured_profile", "stats", "priority_visibility", "organizer_tools"] },
  ];
  for (const p of plans) await db.plan.upsert({ where: { code: p.code }, create: p, update: {} });

  // Discovery sources (created once; staff manage them in /admin/discovery afterwards).
  const cities = await db.city.findMany({ select: { id: true, slug: true, name: true } });
  for (const city of cities) {
    await db.discoverySource.upsert({
      where: { key: `osm-${city.slug}-nightlife` },
      create: {
        key: `osm-${city.slug}-nightlife`, name: `OpenStreetMap · ocio nocturno de ${city.name}`, type: "OSM_OVERPASS", cityId: city.id, trust: "IMPORTED",
        enabled: ENABLED_CITIES.has(city.slug), autoPublish: true,
        config: { categories: ["nightclub", "dance_club", "music_venue", "live_music_venue", "event_venue"], radiusKm: 12 },
      },
      update: {},
    });
  }
  const bcn = cities.find((c) => c.slug === "barcelona");
  if (bcn) {
    await db.discoverySource.upsert({
      where: { key: "ticketmaster-bcn-music" },
      create: { key: "ticketmaster-bcn-music", name: "Ticketmaster · música en Barcelona", type: "TICKETMASTER", cityId: bcn.id, trust: "IMPORTED", enabled: Boolean(process.env.TICKETMASTER_API_KEY), autoPublish: true, config: { classificationName: "music", maxPages: 3 } },
      update: {},
    });
    await db.discoverySource.upsert({
      where: { key: "google-places-bcn-clubs" },
      create: { key: "google-places-bcn-clubs", name: "Google Places · vincular locales de Barcelona", type: "GOOGLE_PLACES", cityId: bcn.id, trust: "IMPORTED", enabled: Boolean(process.env.GOOGLE_PLACES_API_KEY), syncIntervalMin: 7 * 24 * 60, config: { categories: ["nightclub", "music_venue"], maxPages: 1 } },
      update: {},
    });
  }
  log(`${await db.discoverySource.count()} fuentes de descubrimiento`);

  // First administrator (optional).
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 10) throw new Error("ADMIN_PASSWORD debe tener al menos 10 caracteres");
    const username = (process.env.ADMIN_USERNAME ?? "admin").toLowerCase();
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN", status: "ACTIVE" } });
      log(`${email} es administrador`);
    } else {
      await db.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(password, 12),
          role: "ADMIN",
          profile: { create: { username, displayName: "Admin", searchText: buildSearchText(username, "Admin"), cityId: bcn?.id } },
        },
      });
      log(`Administrador creado: ${email} (@${username})`);
    }
  } else {
    log("Sin ADMIN_EMAIL/ADMIN_PASSWORD: no se crea administrador (se puede crear después con el mismo comando)");
  }
  console.log("✅ Listo");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

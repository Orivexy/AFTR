/**
 * Test fixtures for the ISOLATED e2e database only (see scripts/e2e-server.sh):
 * one venue and two events, so the flows have something to open. Users,
 * posts, photos, comments… are created by the tests through the real UI/API.
 */
import { PrismaClient } from "@prisma/client";
import { TZDate } from "@date-fns/tz";

if (!/e2e|test/.test(process.env.DATABASE_URL ?? "")) throw new Error("fixtures.mts only runs against an e2e/test database");

const db = new PrismaClient();
const TZ = "Europe/Madrid";
const city = await db.city.findUniqueOrThrow({ where: { slug: "barcelona" } });
const [club, concert] = await Promise.all([db.category.findUniqueOrThrow({ where: { slug: "discoteca" } }), db.category.findUniqueOrThrow({ where: { slug: "concierto" } })]);
const techno = await db.musicGenre.findUniqueOrThrow({ where: { slug: "techno" } });
// The seeded test admin organises the fixture events.
const organizer = await db.user.findUniqueOrThrow({ where: { email: "admin@e2e.test" } });

const venue = await db.venue.create({
  data: {
    slug: "sala-prueba-e2e",
    name: "Sala Prueba E2E",
    type: "CLUB",
    cityId: city.id,
    address: "Carrer de Prova 1, Barcelona",
    neighborhood: "Gràcia",
    lat: 41.4036,
    lng: 2.1571,
    trust: "VERIFIED",
    openingHours: Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, [{ open: "00:00", close: "23:59" }]])),
    searchText: "sala prueba e2e carrer de prova 1 barcelona gracia barcelona",
    genres: { create: [{ genreId: techno.id }] },
  },
});

// "Tonight" = the current night (06:00 → 06:00 local): starts soon, ends in a few hours.
const now = Date.now();
const local = new TZDate(now, TZ);
const tomorrow22 = new TZDate(local.getFullYear(), local.getMonth(), local.getDate() + (local.getHours() < 6 ? 0 : 1), 22, 0, 0, TZ);

await db.event.create({
  data: {
    slug: "noche-prueba-e2e",
    title: "Noche Prueba E2E",
    description: "Evento de prueba de la suite e2e.",
    cityId: city.id,
    venueId: venue.id,
    organizerId: organizer.id,
    categoryId: club.id,
    locationName: venue.name,
    address: venue.address,
    lat: venue.lat,
    lng: venue.lng,
    startsAt: new Date(now + 20 * 60_000),
    endsAt: new Date(now + 4 * 3600_000),
    priceMin: 0,
    status: "PUBLISHED",
    source: "USER",
    trust: "VERIFIED",
    searchText: "noche prueba e2e sala prueba e2e",
    genres: { create: [{ genreId: techno.id }] },
  },
});
await db.event.create({
  data: {
    slug: "concierto-prueba-e2e",
    title: "Concierto Prueba E2E",
    cityId: city.id,
    venueId: venue.id,
    organizerId: organizer.id,
    categoryId: concert.id,
    locationName: venue.name,
    address: venue.address,
    lat: venue.lat,
    lng: venue.lng,
    startsAt: new Date(tomorrow22.getTime()),
    endsAt: new Date(tomorrow22.getTime() + 4 * 3600_000),
    priceMin: 1500,
    priceMax: 1500,
    status: "PUBLISHED",
    source: "USER",
    trust: "VERIFIED",
    searchText: "concierto prueba e2e sala prueba e2e",
  },
});
console.log("[e2e] fixtures ready");
await db.$disconnect();

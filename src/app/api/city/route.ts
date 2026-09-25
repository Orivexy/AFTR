import { NextResponse } from "next/server";
import { z } from "zod";
import { route, parseJson, badRequest } from "@/server/http";
import { CITY_COOKIE, getCityBySlug, listCities } from "@/server/services/cities";

export const GET = route({}, async () => ({ cities: await listCities() }));

/** Remembers the city the visitor chose (no location is ever inferred). */
export const POST = route({}, async ({ req }) => {
  const { slug } = await parseJson(req, z.object({ slug: z.string().max(40) }));
  const city = await getCityBySlug(slug);
  if (!city) throw badRequest("Ciudad no válida");
  const res = NextResponse.json({ city });
  res.cookies.set(CITY_COOKIE, city.slug, { path: "/", sameSite: "lax", maxAge: 365 * 24 * 3600 });
  return res;
});

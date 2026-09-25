import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "../db";
import { site } from "@/config/site";

export const CITY_COOKIE = `${site.slug}_city`;

export interface CityData {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  lat: number;
  lng: number;
  currency: string;
  countryCode: string;
}

const select = {
  id: true,
  slug: true,
  name: true,
  timezone: true,
  lat: true,
  lng: true,
  country: { select: { currency: true, code: true } },
} as const;

type Row = { id: string; slug: string; name: string; timezone: string; lat: number; lng: number; country: { currency: string; code: string } };
const toCity = ({ country, ...c }: Row): CityData => ({ ...c, currency: country.currency, countryCode: country.code });

export const listCities = cache(async (): Promise<CityData[]> => {
  const rows = await db.city.findMany({ where: { isActive: true }, select, orderBy: { name: "asc" } });
  return rows.map(toCity);
});

export async function getCityBySlug(slug: string): Promise<CityData | null> {
  const cities = await listCities();
  return cities.find((c) => c.slug === slug) ?? null;
}

/**
 * The city the visitor is browsing: explicit cookie choice, else the
 * default city. We never infer it from IP or location without permission.
 */
export const getCurrentCity = cache(async (): Promise<CityData> => {
  const slug = (await cookies()).get(CITY_COOKIE)?.value ?? site.defaultCitySlug;
  const cities = await listCities();
  const city = cities.find((c) => c.slug === slug) ?? cities.find((c) => c.slug === site.defaultCitySlug) ?? cities[0];
  if (!city) throw new Error("No cities configured. Run `npm run db:seed`.");
  return city;
});

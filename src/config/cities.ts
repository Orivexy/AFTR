/**
 * Launch cities. Adding a city = add it here and run the seed (or insert
 * a City row). Everything else (venues, events, feed) is scoped by cityId.
 */
export const COUNTRIES = [{ code: "ES", name: "España", currency: "EUR" }] as const;

export const CITIES = [
  { slug: "barcelona", name: "Barcelona", countryCode: "ES", lat: 41.3874, lng: 2.1686, timezone: "Europe/Madrid" },
  { slug: "madrid", name: "Madrid", countryCode: "ES", lat: 40.4168, lng: -3.7038, timezone: "Europe/Madrid" },
  { slug: "valencia", name: "Valencia", countryCode: "ES", lat: 39.4699, lng: -0.3763, timezone: "Europe/Madrid" },
  { slug: "sevilla", name: "Sevilla", countryCode: "ES", lat: 37.3891, lng: -5.9845, timezone: "Europe/Madrid" },
  { slug: "malaga", name: "Málaga", countryCode: "ES", lat: 36.7213, lng: -4.4214, timezone: "Europe/Madrid" },
  { slug: "ibiza", name: "Ibiza", countryCode: "ES", lat: 38.9067, lng: 1.4206, timezone: "Europe/Madrid" },
] as const;

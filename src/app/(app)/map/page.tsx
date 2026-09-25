import type { Metadata } from "next";
import { NightMap } from "@/components/map/night-map";
import { getCurrentCity } from "@/server/services/cities";
import { getMapConfig, getMapPlaces } from "@/server/services/map";

export const metadata: Metadata = { title: "Mapa" };

export default async function MapPage() {
  const city = await getCurrentCity();
  const places = await getMapPlaces(city);
  return <NightMap config={getMapConfig()} places={places} center={{ lat: city.lat, lng: city.lng }} />;
}

import { HomeMap } from "@/components/map/home-map";
import { getCurrentCity } from "@/server/services/cities";
import { getMapConfig, getMapPlaces } from "@/server/services/map";

export const dynamic = "force-dynamic";

/** Home: the map of Barcelona's verified places. */
export default async function HomePage() {
  const city = await getCurrentCity();
  const places = await getMapPlaces(city);
  return <HomeMap config={getMapConfig()} places={places} center={{ lat: city.lat, lng: city.lng }} cityName={city.name} />;
}

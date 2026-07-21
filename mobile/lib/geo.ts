import type { Dinner } from "@/types";

// Tel Aviv-centered placeholder geography, shared by the native and web map implementations.
// Dinners don't carry real lat/lng yet, so we scatter them deterministically around the city center.
export const TEL_AVIV_REGION = {
  latitude: 32.0853,
  longitude: 34.7818,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) % 1000;
  return hash;
}

export function pseudoCoordsForDinner(dinner: Dinner): { latitude: number; longitude: number } {
  // Two independently-salted hashes so dinners scatter across both axes instead of landing on
  // a single diagonal line (which a shared offset would produce).
  const latOffset = (hashString(dinner.id + "lat") / 1000 - 0.5) * 0.05;
  const lonOffset = (hashString(dinner.id + "lon") / 1000 - 0.5) * 0.05;
  return { latitude: TEL_AVIV_REGION.latitude + latOffset, longitude: TEL_AVIV_REGION.longitude + lonOffset };
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Great-circle distance between two points, in kilometers. */
export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Radius filter presets shown as chips on Discover. `km: null` means "no radius filter". */
export const RADIUS_OPTIONS: { label: string; km: number | null }[] = [
  { label: "Anywhere", km: null },
  { label: "1 km", km: 1 },
  { label: "2 km", km: 2 },
  { label: "5 km", km: 5 },
];

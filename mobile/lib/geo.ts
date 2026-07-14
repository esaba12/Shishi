import type { Dinner } from "@/types";

// Tel Aviv-centered placeholder geography, shared by the native and web map implementations.
// Dinners don't carry real lat/lng yet, so we scatter them deterministically around the city center.
export const TEL_AVIV_REGION = {
  latitude: 32.0853,
  longitude: 34.7818,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export function pseudoCoordsForDinner(dinner: Dinner): { latitude: number; longitude: number } {
  let hash = 0;
  for (let i = 0; i < dinner.id.length; i++) hash = (hash * 31 + dinner.id.charCodeAt(i)) % 1000;
  const offset = (hash / 1000 - 0.5) * 0.05;
  return { latitude: TEL_AVIV_REGION.latitude + offset, longitude: TEL_AVIV_REGION.longitude + offset };
}

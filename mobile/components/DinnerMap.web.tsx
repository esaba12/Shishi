import React, { useEffect } from "react";
import { View } from "react-native";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { TEL_AVIV_REGION, pseudoCoordsForDinner, type LatLng } from "@/lib/geo";
import { colors } from "@/constants/theme";
import type { Dinner } from "@/types";

// Web map via Leaflet + OpenStreetMap (free, no API key). Only loaded on web — native uses
// DinnerMap.tsx (react-native-maps).
//
// Leaflet's CSS is injected at runtime (below) rather than `import`ed, because Metro's web CSS
// handling can't resolve the relative url(images/…) references inside leaflet.css, which produced
// "Importing local resources in CSS is not supported yet" build warnings. Our web.output is "single"
// (SPA), under which app/+html.tsx isn't used for the exported document, so a build-time <link> there
// has no effect either — runtime injection is the fix that actually reaches the page.
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

function useLeafletStylesheet() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS_URL;
    document.head.appendChild(link);
  }, []);
}

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

/** Must render as a child of MapContainer — useMapEvents only works inside the Leaflet context. */
function CenterTracker({ onChange }: { onChange: (center: LatLng) => void }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onChange({ latitude: c.lat, longitude: c.lng });
    },
  });
  return null;
}

interface DinnerMapProps {
  dinners: Dinner[];
  onSelect: (id: string) => void;
  center?: LatLng;
  radiusKm?: number | null;
  onRegionChange?: (center: LatLng) => void;
}

export function DinnerMap({ dinners, onSelect, center, radiusKm, onRegionChange }: DinnerMapProps) {
  useLeafletStylesheet();

  return (
    // zIndex keeps the map's internal stacking (tiles/controls/popups) below the app's fixed nav
    // chrome (desktop sidebar / mobile tab bar), replacing what would otherwise be a global
    // `.leaflet-container { z-index: 0 }` CSS rule — also unreachable under "single" output.
    <View style={{ flex: 1, minHeight: 0, zIndex: 0 }}>
      <MapContainer
        center={[TEL_AVIV_REGION.latitude, TEL_AVIV_REGION.longitude]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {onRegionChange && <CenterTracker onChange={onRegionChange} />}
        {center && radiusKm != null && (
          <Circle
            center={[center.latitude, center.longitude]}
            radius={radiusKm * 1000}
            pathOptions={{ color: colors.brand, weight: 1.5, fillColor: colors.brand, fillOpacity: 0.08 }}
          />
        )}
        {dinners.map((dinner) => {
          const c = pseudoCoordsForDinner(dinner);
          return (
            <Marker
              key={dinner.id}
              position={[c.latitude, c.longitude]}
              icon={markerIcon}
              eventHandlers={{ click: () => onSelect(dinner.id) }}
            >
              <Popup>
                {dinner.hostName} · {dinner.area}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </View>
  );
}

import React from "react";
import { View } from "react-native";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TEL_AVIV_REGION, pseudoCoordsForDinner } from "@/lib/geo";
import type { Dinner } from "@/types";

// Web map via Leaflet + OpenStreetMap (free, no API key). Only loaded on web — native uses
// DinnerMap.tsx (react-native-maps). Leaflet's bundled marker images don't resolve through metro,
// so we point at the CDN copies (tiles already require network anyway).
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function DinnerMap({ dinners, onSelect }: { dinners: Dinner[]; onSelect: (id: string) => void }) {
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <MapContainer
        center={[TEL_AVIV_REGION.latitude, TEL_AVIV_REGION.longitude]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
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

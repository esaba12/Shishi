import React from "react";
import { StyleSheet } from "react-native";
import MapView, { Circle, Marker, type Region } from "react-native-maps";
import { TEL_AVIV_REGION, pseudoCoordsForDinner, type LatLng } from "@/lib/geo";
import { colors } from "@/constants/theme";
import type { Dinner } from "@/types";

interface DinnerMapProps {
  dinners: Dinner[];
  onSelect: (id: string) => void;
  center?: LatLng;
  radiusKm?: number | null;
  onRegionChange?: (center: LatLng) => void;
}

// Native map (iOS/Android) via react-native-maps. The web override lives in DinnerMap.web.tsx;
// metro resolves the right file per platform, so this native-only import never reaches the web bundle.
export function DinnerMap({ dinners, onSelect, center, radiusKm, onRegionChange }: DinnerMapProps) {
  return (
    <MapView
      style={styles.map}
      initialRegion={TEL_AVIV_REGION}
      onRegionChangeComplete={(region: Region) =>
        onRegionChange?.({ latitude: region.latitude, longitude: region.longitude })
      }
    >
      {center && radiusKm != null && (
        <Circle
          center={center}
          radius={radiusKm * 1000}
          strokeWidth={1.5}
          strokeColor={colors.brand}
          fillColor="rgba(225, 29, 72, 0.08)"
        />
      )}
      {dinners.map((dinner) => (
        <Marker
          key={dinner.id}
          coordinate={pseudoCoordsForDinner(dinner)}
          title={dinner.hostName}
          description={`${dinner.area} · ${dinner.startTime}`}
          onCalloutPress={() => onSelect(dinner.id)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({ map: { flex: 1 } });

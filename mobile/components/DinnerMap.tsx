import React from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { TEL_AVIV_REGION, pseudoCoordsForDinner } from "@/lib/geo";
import type { Dinner } from "@/types";

// Native map (iOS/Android) via react-native-maps. The web override lives in DinnerMap.web.tsx;
// metro resolves the right file per platform, so this native-only import never reaches the web bundle.
export function DinnerMap({ dinners, onSelect }: { dinners: Dinner[]; onSelect: (id: string) => void }) {
  return (
    <MapView style={styles.map} initialRegion={TEL_AVIV_REGION}>
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

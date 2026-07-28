import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AnimatePresence, MotiView } from "moti";
import { Ionicons } from "@expo/vector-icons";
import { DinnerMap } from "@/components/DinnerMap";
import { colors, elevation, radii, spacing, typography } from "@/constants/theme";
import { haversineDistanceKm, type LatLng } from "@/lib/geo";
import { useReducedMotion } from "@/lib/useReducedMotion";
import type { Dinner } from "@/types";

// How far the map has to be dragged from the applied search center before we bother surfacing
// the "Search this area" affordance — avoids the button flickering in on tiny/inertial pans.
const REDO_SEARCH_THRESHOLD_KM = 0.3;

interface DinnerMapPaneProps {
  dinners: Dinner[];
  onSelect: (id: string) => void;
  center: LatLng;
  radiusKm: number | null;
  onSearchThisArea: (center: LatLng) => void;
}

/** Wraps DinnerMap with the Airbnb-style "search as you move the map" affordance: dragging the
 *  map doesn't refilter results immediately — it surfaces a floating button that, once pressed,
 *  re-centers the radius filter (owned by the parent) on wherever the map now sits. */
export function DinnerMapPane({ dinners, onSelect, center, radiusKm, onSearchThisArea }: DinnerMapPaneProps) {
  const [pendingCenter, setPendingCenter] = useState<LatLng | null>(null);
  const reducedMotion = useReducedMotion();

  const showSearchButton =
    radiusKm != null && pendingCenter != null && haversineDistanceKm(pendingCenter, center) > REDO_SEARCH_THRESHOLD_KM;

  return (
    <View style={styles.pane}>
      <DinnerMap
        dinners={dinners}
        onSelect={onSelect}
        center={center}
        radiusKm={radiusKm}
        onRegionChange={setPendingCenter}
      />
      <AnimatePresence>
        {showSearchButton && (
          <MotiView
            style={styles.searchBtnWrap}
            from={{ opacity: 0, translateY: reducedMotion ? 0 : -8 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: reducedMotion ? 0 : -8 }}
            transition={{ type: "timing", duration: reducedMotion ? 0 : 200 }}
          >
            <Pressable
              style={[styles.searchBtn, elevation.raised]}
              onPress={() => {
                onSearchThisArea(pendingCenter!);
                setPendingCenter(null);
              }}
            >
              <Ionicons name="refresh" size={14} color={colors.onBrand} />
              <Text style={styles.searchBtnText}>Search this area</Text>
            </Pressable>
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: { flex: 1 },
  searchBtnWrap: {
    position: "absolute",
    top: spacing.md,
    alignSelf: "center",
  },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchBtnText: { ...typography.bodyBold, color: colors.onBrand },
});

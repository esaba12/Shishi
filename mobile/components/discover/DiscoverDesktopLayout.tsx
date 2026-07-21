import React from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { EmptyState } from "@/components/ui/EmptyState";
import { DinnerCardSkeleton } from "@/components/ui/Skeleton";
import { DinnerCard } from "@/components/DinnerCard";
import { DinnerMapPane } from "@/components/discover/DinnerMapPane";
import { colors, spacing } from "@/constants/theme";
import { t } from "@/lib/i18n";
import type { LatLng } from "@/lib/geo";
import type { Dinner } from "@/types";

interface DiscoverDesktopLayoutProps {
  /** Full kosher-filtered set — every one gets a pin on the map regardless of the radius filter. */
  dinners: Dinner[];
  /** Radius-filtered subset shown in the list column, mirroring what the radius circle covers. */
  visibleDinners: Dinner[];
  loading: boolean;
  onRefresh: () => void;
  onSelect: (dinnerId: string) => void;
  onHost: () => void;
  mapCenter: LatLng;
  radiusKm: number | null;
  onSearchThisArea: (center: LatLng) => void;
}

/** Desktop-only persistent split view: a scrollable card list beside a fixed map, so a wide viewport
 *  isn't just a stretched-out phone layout. Mobile/tablet keep the single-column list/map toggle in
 *  app/(tabs)/index.tsx unchanged. */
export function DiscoverDesktopLayout({
  dinners,
  visibleDinners,
  loading,
  onRefresh,
  onSelect,
  onHost,
  mapCenter,
  radiusKm,
  onSearchThisArea,
}: DiscoverDesktopLayoutProps) {
  const initialLoading = loading && dinners.length === 0;

  return (
    <View style={styles.split}>
      <View style={styles.listColumn}>
        {initialLoading ? (
          <View style={styles.listContent}>
            {[0, 1, 2, 3].map((i) => (
              <DinnerCardSkeleton key={i} />
            ))}
          </View>
        ) : (
          <FlatList
            data={visibleDinners}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshing={loading}
            onRefresh={onRefresh}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <DinnerCard dinner={item} onPress={() => onSelect(item.id)} />}
            ListEmptyComponent={
              <EmptyState
                icon="restaurant-outline"
                title={t("discover.emptyTitle")}
                description={t("discover.emptyBody")}
                actionLabel={t("discover.host")}
                onAction={onHost}
              />
            }
          />
        )}
      </View>
      <View style={styles.mapColumn}>
        <DinnerMapPane
          dinners={dinners}
          onSelect={onSelect}
          center={mapCenter}
          radiusKm={radiusKm}
          onSearchThisArea={onSearchThisArea}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: "row" },
  listColumn: {
    width: 420,
    borderEndWidth: 1,
    borderEndColor: colors.border,
  },
  listContent: { padding: spacing.lg },
  mapColumn: { flex: 1 },
});

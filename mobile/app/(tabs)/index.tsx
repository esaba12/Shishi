import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { DinnerCardSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { DinnerCard } from "@/components/DinnerCard";
import { DinnerMapPane } from "@/components/discover/DinnerMapPane";
import { DiscoverDesktopLayout } from "@/components/discover/DiscoverDesktopLayout";
import { Logo } from "@/components/brand/Logo";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { KOSHER_LEVELS } from "@/constants/options";
import { t } from "@/lib/i18n";
import { useResponsive } from "@/lib/responsive";
import { fetchDinners } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { RADIUS_OPTIONS, TEL_AVIV_REGION, haversineDistanceKm, pseudoCoordsForDinner, type LatLng } from "@/lib/geo";
import type { Dinner } from "@/types";
import type { KosherLevel } from "@/types/database";

export default function Discover() {
  const [dinners, setDinners] = useState<Dinner[]>([]);
  const [kosherFilter, setKosherFilter] = useState<KosherLevel | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "map">("list");
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng>(TEL_AVIV_REGION);
  const { show } = useToast();
  const { isDesktop } = useResponsive();
  const { profile, hostDetails, sponsorDetails } = useAuth();
  const isHost = profile?.roles.includes("host");
  const isSponsor = profile?.roles.includes("sponsor");

  const visibleDinners =
    radiusKm == null ? dinners : dinners.filter((d) => haversineDistanceKm(pseudoCoordsForDinner(d), mapCenter) <= radiusKm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchDinners(kosherFilter ? { kosherLevel: kosherFilter } : {});
      setDinners(result);
    } catch {
      show("Couldn't load dinners. Pull to try again.", "error");
    } finally {
      setLoading(false);
    }
  }, [kosherFilter, show]);

  useEffect(() => {
    load();
  }, [load]);

  const initialLoading = loading && dinners.length === 0;

  return (
    <Screen scroll={false} padded={false} fullBleed={isDesktop}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Logo size={30} />
          {!isDesktop ? (
            <Pressable
              style={styles.viewToggle}
              onPress={() => setView((v) => (v === "list" ? "map" : "list"))}
            >
              <Ionicons name={view === "list" ? "map" : "list"} size={15} color={colors.brand} />
              <Text style={styles.viewToggleText}>{view === "list" ? t("discover.map") : t("discover.list")}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.greeting}>{t("discover.greeting")}</Text>
        <Text style={styles.title}>{t("discover.title")}</Text>
        <Text style={styles.subtitle}>{t("discover.subtitle")}</Text>

        {isHost && hostDetails && (
          <View style={styles.personaCard}>
            <Text style={styles.personaCardText}>
              You've hosted {hostDetails.dinnersHostedCount} Shabbats so far.
            </Text>
            <Pressable style={styles.personaCardBtn} onPress={() => router.push("/dinner/create")}>
              <Text style={styles.personaCardBtnText}>Host a new dinner</Text>
            </Pressable>
          </View>
        )}
        {isSponsor && sponsorDetails && (
          <View style={styles.personaCard}>
            <Text style={styles.personaCardText}>
              Your giving budget is up to ₪{sponsorDetails.budgetCeiling ?? "—"} per dinner.
            </Text>
            <Pressable style={styles.personaCardBtn} onPress={() => router.push("/sponsor")}>
              <Text style={styles.personaCardBtnText}>Browse the donor feed</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.chipRow}>
          <Chip label={t("discover.all")} selected={kosherFilter === null} onPress={() => setKosherFilter(null)} />
          {KOSHER_LEVELS.map((k) => (
            <Chip
              key={k.value}
              label={k.label}
              selected={kosherFilter === k.value}
              onPress={() => setKosherFilter(k.value)}
            />
          ))}
        </View>
        <View style={styles.chipRow}>
          {RADIUS_OPTIONS.map((opt) => (
            <Chip key={opt.label} label={opt.label} selected={radiusKm === opt.km} onPress={() => setRadiusKm(opt.km)} />
          ))}
        </View>
        {radiusKm != null && (
          <Text style={styles.resultsCaption}>
            {visibleDinners.length} dinner{visibleDinners.length === 1 ? "" : "s"} within {radiusKm}km
          </Text>
        )}
      </View>

      {isDesktop ? (
        <DiscoverDesktopLayout
          dinners={dinners}
          visibleDinners={visibleDinners}
          loading={loading}
          onRefresh={load}
          onSelect={(dinnerId) => router.push(`/dinner/${dinnerId}`)}
          onHost={() => router.push("/dinner/create")}
          mapCenter={mapCenter}
          radiusKm={radiusKm}
          onSearchThisArea={setMapCenter}
        />
      ) : view === "map" ? (
        <DinnerMapPane
          dinners={dinners}
          onSelect={(dinnerId) => router.push(`/dinner/${dinnerId}`)}
          center={mapCenter}
          radiusKm={radiusKm}
          onSearchThisArea={setMapCenter}
        />
      ) : initialLoading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <DinnerCardSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={visibleDinners}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={load}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <DinnerCard dinner={item} onPress={() => router.push(`/dinner/${item.id}`)} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="restaurant-outline"
              title={t("discover.emptyTitle")}
              description={t("discover.emptyBody")}
              actionLabel={t("discover.host")}
              onAction={() => router.push("/dinner/create")}
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  viewToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  viewToggleText: { ...typography.label, color: colors.brand },
  greeting: { ...typography.label, color: colors.brand, textTransform: "uppercase" },
  title: { ...typography.h1, color: colors.textPrimary, marginTop: 2 },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md },
  chipRow: { flexDirection: "row", flexWrap: "wrap" },
  resultsCaption: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  personaCard: {
    backgroundColor: colors.brandSoft,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  personaCardText: { ...typography.body, color: colors.brandDark, marginBottom: spacing.sm },
  personaCardBtn: { alignSelf: "flex-start" },
  personaCardBtnText: { ...typography.bodyBold, color: colors.brand },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.xs },
});

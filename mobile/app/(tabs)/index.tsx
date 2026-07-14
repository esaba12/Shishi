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
import { DinnerMap } from "@/components/DinnerMap";
import { Logo } from "@/components/brand/Logo";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { KOSHER_LEVELS } from "@/constants/options";
import { t } from "@/lib/i18n";
import { fetchDinners } from "@/lib/api";
import type { Dinner } from "@/types";
import type { KosherLevel } from "@/types/database";

export default function Discover() {
  const [dinners, setDinners] = useState<Dinner[]>([]);
  const [kosherFilter, setKosherFilter] = useState<KosherLevel | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "map">("list");
  const { show } = useToast();

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
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Logo size={30} />
          <Pressable
            style={styles.viewToggle}
            onPress={() => setView((v) => (v === "list" ? "map" : "list"))}
          >
            <Ionicons name={view === "list" ? "map" : "list"} size={15} color={colors.brand} />
            <Text style={styles.viewToggleText}>{view === "list" ? t("discover.map") : t("discover.list")}</Text>
          </Pressable>
        </View>
        <Text style={styles.greeting}>{t("discover.greeting")}</Text>
        <Text style={styles.title}>{t("discover.title")}</Text>
        <Text style={styles.subtitle}>{t("discover.subtitle")}</Text>
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
      </View>

      {view === "map" ? (
        <DinnerMap dinners={dinners} onSelect={(dinnerId) => router.push(`/dinner/${dinnerId}`)} />
      ) : initialLoading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <DinnerCardSkeleton key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={dinners}
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
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.xs },
});

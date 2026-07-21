import React, { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { DinnerCardSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { useToast } from "@/components/ui/Toast";
import { SponsorDinnerCard } from "@/components/SponsorDinnerCard";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { MISSION_STATS } from "@/constants/options";
import { fetchSponsorFeed } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Dinner } from "@/types";

function NonSponsorUpsell() {
  return (
    <Screen>
      <View style={styles.iconWrap}>
        <Ionicons name="heart" size={32} color={colors.brand} />
      </View>
      <Text style={styles.title}>Fund a real Shabbat table</Text>
      <Text style={styles.subtitle}>
        Browse hosts who need help covering their dinner's budget, fund the ones that speak to you,
        and see the dinner actually happen.
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Want in?</Text>
        <Text style={styles.cardBody}>
          Sign up (or create a new account) and pick "Sponsor" during setup to set your giving
          preferences and open the donor feed.
        </Text>
      </View>
      <Text style={styles.statsHeading}>Why this matters</Text>
      {MISSION_STATS.map((stat) => (
        <View key={stat.value} style={styles.statRow}>
          <Text style={styles.statValue}>{stat.value}</Text>
          <Text style={styles.statLabel}>{stat.label}</Text>
        </View>
      ))}
    </Screen>
  );
}

function DonorFeed() {
  const { sponsorDetails } = useAuth();
  const { show } = useToast();
  const [dinners, setDinners] = useState<Dinner[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchSponsorFeed({
        budgetCeiling: sponsorDetails?.budgetCeiling ?? null,
        locationPref: sponsorDetails?.locationPref ?? null,
        dinnerTypePrefs: sponsorDetails?.dinnerTypePrefs ?? [],
      });
      setDinners(result);
    } catch {
      show("Couldn't load the donor feed. Pull to try again.", "error");
    } finally {
      setLoading(false);
    }
  }, [sponsorDetails, show]);

  useEffect(() => {
    load();
  }, [load]);

  const initialLoading = loading && dinners.length === 0;

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.feedHeader}>
        <Text style={styles.greeting}>DONOR FEED</Text>
        <Text style={styles.title}>Fund a table</Text>
        <Text style={styles.subtitle}>
          Dinners matched to your giving preferences — every one already reviewed and approved.
        </Text>
        <Button
          label="My donations"
          variant="secondary"
          size="sm"
          onPress={() => router.push("/sponsor/my-donations")}
          style={styles.myDonationsBtn}
        />
      </View>

      {initialLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
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
          renderItem={({ item, index }) => (
            <Reveal delay={Math.min(index, 5) * 60}>
              <SponsorDinnerCard dinner={item} onPress={() => router.push(`/dinner/${item.id}/donate`)} />
            </Reveal>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="heart-outline"
              title="No dinners match your preferences right now"
              description="Widen your budget ceiling or location preference from your profile settings, or check back soon — new dinners open for sponsorship every week."
            />
          }
        />
      )}
    </Screen>
  );
}

export default function Sponsor() {
  const { profile } = useAuth();
  const isSponsor = profile?.roles.includes("sponsor");
  return isSponsor ? <DonorFeed /> : <NonSponsorUpsell />;
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { ...typography.h1, color: colors.textPrimary, marginTop: 2, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  cardTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  cardBody: { ...typography.body, color: colors.textSecondary },
  statsHeading: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },
  statRow: { flexDirection: "row", alignItems: "baseline", marginBottom: spacing.md, gap: spacing.sm },
  statValue: { ...typography.h2, color: colors.brand, width: 90 },
  statLabel: { ...typography.body, color: colors.textSecondary, flex: 1 },
  feedHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  greeting: { ...typography.label, color: colors.brand, textTransform: "uppercase" },
  myDonationsBtn: { alignSelf: "flex-start", marginBottom: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, paddingTop: spacing.xs },
});

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { MISSION_STATS } from "@/constants/options";
import { useAuth } from "@/context/AuthContext";

export default function Sponsor() {
  const { profile, sponsorDetails } = useAuth();
  const isWaitlisted = profile?.roles.includes("sponsor");

  return (
    <Screen>
      <View style={styles.iconWrap}>
        <Ionicons name="heart" size={32} color={colors.primary} />
      </View>
      <Text style={styles.title}>Sponsorship is launching soon</Text>
      <Text style={styles.subtitle}>
        Soon you'll be able to fund a real Shabbat table — see who you fed, get photos from the
        dinner, and hear directly from the people you helped.
      </Text>

      {isWaitlisted ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>You're on the list</Text>
          <Text style={styles.cardBody}>
            {sponsorDetails?.whyIGive
              ? `"${sponsorDetails.whyIGive}"`
              : "We'll notify you the moment the donor feed opens."}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Want in?</Text>
          <Text style={styles.cardBody}>
            Add "Sponsor a Shabbat" from your profile settings to join the waitlist and set your
            giving preferences now.
          </Text>
        </View>
      )}

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

const styles = StyleSheet.create({
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FBEDE5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  cardTitle: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.xs },
  cardBody: { ...typography.body, color: colors.textMuted },
  statsHeading: { ...typography.h3, color: colors.text, marginBottom: spacing.md },
  statRow: { flexDirection: "row", alignItems: "baseline", marginBottom: spacing.md, gap: spacing.sm },
  statValue: { ...typography.h2, color: colors.primary, width: 90 },
  statLabel: { ...typography.body, color: colors.textMuted, flex: 1 },
});

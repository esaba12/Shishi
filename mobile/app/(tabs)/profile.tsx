import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";

const ROLE_LABELS: Record<string, string> = {
  attendee: "Attendee",
  host: "Host",
  sponsor: "Sponsor",
};

export default function Profile() {
  const { profile, hostDetails, sponsorDetails, signOut } = useAuth();

  if (!profile) return null;

  // signOut() only clears auth state — it doesn't navigate. Without an explicit redirect the app
  // just sits on this (now-profile-less) tab instead of returning to the welcome screen.
  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.avatar}>
          {profile.photoUrl ? (
            <Image source={{ uri: profile.photoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitial}>{profile.name.charAt(0)}</Text>
          )}
        </View>
        <Text style={styles.name}>{profile.name}</Text>
        <View style={styles.rolesRow}>
          {profile.roles.map((r) => (
            <View key={r} style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{ROLE_LABELS[r]}</Text>
            </View>
          ))}
        </View>
      </View>

      {profile.roles.includes("host") && hostDetails && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hosting</Text>
          <Text style={styles.cardBody}>{hostDetails.bio || "No bio yet."}</Text>
          <Text style={styles.stat}>Hosted {hostDetails.dinnersHostedCount} Shabbats</Text>
        </View>
      )}

      {profile.roles.includes("sponsor") && sponsorDetails && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sponsoring</Text>
          <Text style={styles.cardBody}>{sponsorDetails.whyIGive || "No reason given yet."}</Text>
          <InfoLine label="Budget ceiling" value={sponsorDetails.budgetCeiling != null ? `₪${sponsorDetails.budgetCeiling}` : "—"} />
          <InfoLine label="Location" value={sponsorDetails.locationPref ?? "Anywhere"} />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>About you</Text>
        <InfoLine label="Kosher level" value={profile.kosherLevel ?? "\u2014"} />
        <InfoLine label="Dietary" value={profile.dietaryPrefs ?? "\u2014"} />
        <InfoLine label="Interests" value={profile.interests.join(", ") || "\u2014"} />
        <InfoLine label="Fun fact" value={profile.funFact ?? "\u2014"} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Safety & support</Text>
        <Text style={styles.cardBody}>
          Verified via phone + email. Government-ID verification is coming in a later update.
        </Text>
        <Button
          label="Report a concern"
          variant="secondary"
          onPress={() => router.push("/report")}
          style={{ marginTop: spacing.sm }}
        />
      </View>

      <Button label="Sign out" variant="ghost" onPress={handleSignOut} />
    </Screen>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginBottom: spacing.lg },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: { color: "#fff", fontWeight: "700", fontSize: 32 },
  name: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  rolesRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  roleBadge: {
    backgroundColor: "#F4E3D3",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginHorizontal: 4,
    marginTop: 4,
  },
  roleBadgeText: { ...typography.caption, color: colors.brandDark },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  cardBody: { ...typography.body, color: colors.textSecondary },
  stat: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  infoLabel: { ...typography.caption, color: colors.textSecondary },
  infoValue: { ...typography.body, color: colors.textPrimary, flex: 1, textAlign: "right" },
});

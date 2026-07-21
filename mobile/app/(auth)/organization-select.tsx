import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { SelectCard } from "@/components/ui/SelectCard";
import { colors, spacing, typography } from "@/constants/theme";
import { DEMO_THEMES, useDemoTheme } from "@/context/DemoThemeContext";

export default function OrganizationSelect() {
  const { theme, setTheme } = useDemoTheme();

  return (
    <Screen>
      <Ionicons name="business-outline" size={38} color={theme.brand} style={styles.icon} />
      <Text style={[styles.eyebrow, { color: theme.brand }]}>CHOOSE A WORKSPACE</Text>
      <Text style={styles.title}>Where would you like to start?</Text>
      <Text style={styles.subtitle}>
        Explore a ready-to-use demo or tell us about the organization you want to bring into Shishi.
      </Text>

      <View style={styles.options}>
        <SelectCard
          title="University of Illinois Urbana-Champaign"
          description="Course demand signals and planning review — demo workspace"
          icon="school-outline"
          badge="Demo"
          selected
          onPress={() => router.push("/(auth)/demo-role")}
        />
        <View style={styles.themeSection}>
          <Text style={styles.sectionTitle}>Demo organization color</Text>
          <Text style={styles.sectionDescription}>Preview how a partner&apos;s brand could carry through the workspace.</Text>
          <View style={styles.themeOptions}>
            {DEMO_THEMES.map((candidate) => {
              const selectedTheme = candidate.id === theme.id;
              return (
                <Pressable
                  key={candidate.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedTheme }}
                  onPress={() => setTheme(candidate.id)}
                  style={[styles.themeOption, selectedTheme && { borderColor: candidate.brand, backgroundColor: candidate.brandSoft }]}
                >
                  <View style={[styles.swatch, { backgroundColor: candidate.brand }]}>
                    {selectedTheme ? <Ionicons name="checkmark" size={15} color={candidate.onBrand} /> : null}
                  </View>
                  <Text style={styles.themeName}>{candidate.name}</Text>
                  <Text style={styles.themeDescription}>{candidate.description}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.futureCard}>
          <Ionicons name="add-circle-outline" size={22} color={theme.brand} />
          <View style={styles.futureCopy}>
            <Text style={styles.futureTitle}>Bring your organization</Text>
            <Text style={styles.futureDescription}>Request access and we&apos;ll help set up your workspace.</Text>
          </View>
          <Button label="Request" size="sm" variant="secondary" onPress={() => router.push("/(auth)/request-join")} />
        </View>
      </View>

      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { marginBottom: spacing.md },
  eyebrow: { ...typography.label, color: colors.brand, marginBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  options: { gap: spacing.md, marginBottom: spacing.md },
  themeSection: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: spacing.md },
  sectionTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  sectionDescription: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md },
  themeOptions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  themeOption: { width: "47%", minWidth: 128, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: spacing.sm, backgroundColor: colors.bg },
  swatch: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  themeName: { ...typography.bodyBold, color: colors.textPrimary },
  themeDescription: { ...typography.caption, color: colors.textSecondary },
  futureCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  futureCopy: { flex: 1 },
  futureTitle: { ...typography.h3, color: colors.textPrimary },
  futureDescription: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});

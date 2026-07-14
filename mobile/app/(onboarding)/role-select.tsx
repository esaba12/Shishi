import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { useOnboarding } from "@/context/OnboardingContext";
import type { Role } from "@/types";

const ROLE_OPTIONS: { role: Role; title: string; description: string }[] = [
  { role: "attendee", title: "Find a Shabbat table", description: "Browse dinners and RSVP for a seat." },
  { role: "host", title: "Host a Shabbat", description: "Open your home and gather a table." },
  {
    role: "sponsor",
    title: "Sponsor a Shabbat",
    description: "Fund dinners for people who need a table. Launching soon \u2014 join the waitlist now.",
  },
];

export default function RoleSelect() {
  const { setRoles } = useOnboarding();
  const [selected, setSelected] = useState<Role[]>(["attendee"]);

  function toggle(role: Role) {
    setSelected((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function handleContinue() {
    setRoles(selected);
    router.push("/(onboarding)/attendee");
  }

  return (
    <Screen>
      <Text style={styles.title}>What brings you to Shishi?</Text>
      <Text style={styles.subtitle}>Pick as many as apply \u2014 you can add more later.</Text>
      <View style={styles.options}>
        {ROLE_OPTIONS.map((opt) => {
          const isSelected = selected.includes(opt.role);
          return (
            <View
              key={opt.role}
              style={[styles.card, isSelected && styles.cardSelected]}
              onTouchEnd={() => toggle(opt.role)}
            >
              <Text style={styles.cardTitle}>{opt.title}</Text>
              <Text style={styles.cardDescription}>{opt.description}</Text>
            </View>
          );
        })}
      </View>
      <Button label="Continue" onPress={handleContinue} disabled={selected.length === 0} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  options: { marginBottom: spacing.lg },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: "#FBEDE5",
  },
  cardTitle: { ...typography.bodyBold, color: colors.text, marginBottom: 2 },
  cardDescription: { ...typography.caption, color: colors.textMuted },
});

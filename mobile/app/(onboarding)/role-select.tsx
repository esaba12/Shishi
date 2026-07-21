import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { SelectCard } from "@/components/ui/SelectCard";
import { StepProgress } from "@/components/ui/StepProgress";
import { Reveal } from "@/components/ui/Reveal";
import { colors, spacing, typography } from "@/constants/theme";
import { onboardingStepCount } from "@/lib/onboardingSteps";
import { useOnboarding } from "@/context/OnboardingContext";
import type { Role } from "@/types";

const ROLE_OPTIONS: {
  role: Role;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
}[] = [
  {
    role: "attendee",
    title: "Find a Shabbat table",
    description: "Browse dinners and RSVP for a seat.",
    icon: "restaurant-outline",
  },
  {
    role: "host",
    title: "Host a Shabbat",
    description: "Open your home and gather a table.",
    icon: "home-outline",
  },
  {
    role: "sponsor",
    title: "Sponsor a Shabbat",
    description: "Fund dinners for people who need a table.",
    icon: "heart-outline",
  },
];

export default function RoleSelect() {
  const { setRoles } = useOnboarding();
  const [selected, setSelected] = useState<Role[]>(["attendee"]);
  const total = useMemo(() => onboardingStepCount(selected), [selected]);

  function toggle(role: Role) {
    setSelected((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  function handleContinue() {
    setRoles(selected);
    router.push("/(onboarding)/attendee");
  }

  return (
    <Screen>
      <Reveal>
        <StepProgress step={1} total={total} />
        <Text style={styles.title}>What brings you to Shishi?</Text>
        <Text style={styles.subtitle}>Pick as many as apply — you can add more later.</Text>
      </Reveal>
      <View style={styles.options}>
        {ROLE_OPTIONS.map((opt, i) => (
          <Reveal key={opt.role} delay={110 + i * 70} style={styles.cardReveal}>
            <SelectCard
              title={opt.title}
              description={opt.description}
              icon={opt.icon}
              badge={opt.badge}
              selected={selected.includes(opt.role)}
              onPress={() => toggle(opt.role)}
            />
          </Reveal>
        ))}
      </View>
      <Reveal delay={110 + ROLE_OPTIONS.length * 70 + 60}>
        <Button label="Continue" onPress={handleContinue} disabled={selected.length === 0} size="lg" />
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  options: { marginBottom: spacing.lg },
  cardReveal: { marginBottom: spacing.md },
});

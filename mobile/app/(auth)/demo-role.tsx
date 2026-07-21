import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { SelectCard } from "@/components/ui/SelectCard";
import { Reveal } from "@/components/ui/Reveal";
import { colors, spacing, typography } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/types";

const PERSONAS: { role: Role; title: string; description: string; icon: "restaurant-outline" | "home-outline" | "heart-outline" }[] = [
  {
    role: "attendee",
    title: "Just here to attend",
    description: "Browse dinners, RSVP, and see what a guest sees.",
    icon: "restaurant-outline",
  },
  {
    role: "host",
    title: "I host dinners",
    description: "Create a dinner, manage RSVPs, run the potluck checklist.",
    icon: "home-outline",
  },
  {
    role: "sponsor",
    title: "I want to sponsor",
    description: "Browse the donor feed and fund a dinner's budget.",
    icon: "heart-outline",
  },
];

// A quick "who do you want to be" fork before dropping into demo mode — each persona is seeded with
// matching mock host/sponsor details so the relevant screens (host tools, donor feed) aren't empty.
export default function DemoRole() {
  const { continueAsDemoUser } = useAuth();
  const [selected, setSelected] = useState<Role>("attendee");

  function handleContinue() {
    continueAsDemoUser(selected);
    router.replace("/(tabs)");
  }

  return (
    <Screen scroll={false}>
      <Reveal>
        <Text style={styles.title}>I want to be a...</Text>
        <Text style={styles.subtitle}>Pick a persona to explore the demo as — you can always come back and try another.</Text>
      </Reveal>
      <View style={styles.options}>
        {PERSONAS.map((p, i) => (
          <Reveal key={p.role} delay={90 + i * 70} style={styles.cardReveal}>
            <SelectCard
              title={p.title}
              description={p.description}
              icon={p.icon}
              selected={selected === p.role}
              onPress={() => setSelected(p.role)}
            />
          </Reveal>
        ))}
      </View>
      <Reveal delay={90 + PERSONAS.length * 70 + 60}>
        <Button label="Enter the demo" onPress={handleContinue} size="lg" />
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

import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { StepProgress } from "@/components/ui/StepProgress";
import { Reveal } from "@/components/ui/Reveal";
import { colors, spacing, typography } from "@/constants/theme";
import { onboardingStepCount, onboardingStepIndex } from "@/lib/onboardingSteps";
import { useOnboarding } from "@/context/OnboardingContext";

export default function HostOnboarding() {
  const { draft, setHostDetails } = useOnboarding();
  const [bio, setBio] = useState(draft.hostDetails.bio ?? "");
  const [homeVibe, setHomeVibe] = useState(draft.hostDetails.homeVibe ?? "");

  function handleContinue() {
    setHostDetails({ bio, homeVibe });
    if (draft.roles.includes("sponsor")) {
      router.push("/(onboarding)/sponsor");
    } else {
      router.push("/(onboarding)/done");
    }
  }

  return (
    <Screen>
      <Reveal>
        <StepProgress step={onboardingStepIndex("host", draft.roles)} total={onboardingStepCount(draft.roles)} />
        <Text style={styles.title}>Your hosting style</Text>
        <Text style={styles.subtitle}>
          A quick verification note: for now we verify hosts by phone + email, same as everyone else.
          ID verification is coming in a later update.
        </Text>
      </Reveal>
      <TextField
        label="Hosting bio"
        value={bio}
        onChangeText={setBio}
        placeholder="Tell guests a bit about your Shabbat table."
        multiline
        numberOfLines={4}
        style={{ minHeight: 90, textAlignVertical: "top" }}
      />
      <TextField
        label="Home vibe"
        value={homeVibe}
        onChangeText={setHomeVibe}
        placeholder="Cozy and quiet, big and musical, ..."
      />
      <Button label="Continue" onPress={handleContinue} disabled={bio.trim().length === 0} size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
});

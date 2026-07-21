import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { StepProgress } from "@/components/ui/StepProgress";
import { Reveal } from "@/components/ui/Reveal";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { DINNER_TYPE_TAGS } from "@/constants/options";
import { onboardingStepCount, onboardingStepIndex } from "@/lib/onboardingSteps";
import { useOnboarding } from "@/context/OnboardingContext";

export default function SponsorOnboarding() {
  const { draft, setSponsorDetails } = useOnboarding();
  const [whyIGive, setWhyIGive] = useState(draft.sponsorDetails.whyIGive ?? "");
  const [budgetCeiling, setBudgetCeiling] = useState(
    draft.sponsorDetails.budgetCeiling?.toString() ?? ""
  );
  const [monthlyBudget, setMonthlyBudget] = useState(
    draft.sponsorDetails.monthlyBudget?.toString() ?? ""
  );
  const [locationPref, setLocationPref] = useState(draft.sponsorDetails.locationPref ?? "");
  const [dinnerTypePrefs, setDinnerTypePrefs] = useState<string[]>(
    draft.sponsorDetails.dinnerTypePrefs ?? []
  );

  function toggleTag(tag: string) {
    setDinnerTypePrefs((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function handleContinue() {
    setSponsorDetails({
      whyIGive,
      budgetCeiling: budgetCeiling ? Number(budgetCeiling) : null,
      monthlyBudget: monthlyBudget ? Number(monthlyBudget) : null,
      locationPref,
      dinnerTypePrefs,
    });
    router.push("/(onboarding)/done");
  }

  return (
    <Screen>
      <Reveal>
        <StepProgress step={onboardingStepIndex("sponsor", draft.roles)} total={onboardingStepCount(draft.roles)} />
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            These preferences shape your donor feed — dinners that fit your budget and interests show
            up first. You can fund a dinner as soon as you finish setting up.
          </Text>
        </View>
        <Text style={styles.title}>Your giving preferences</Text>
      </Reveal>
      <TextField
        label="Why do you give?"
        value={whyIGive}
        onChangeText={setWhyIGive}
        placeholder="A short blurb shown on your sponsor profile."
        multiline
        numberOfLines={3}
        style={{ minHeight: 70, textAlignVertical: "top" }}
      />
      <TextField
        label="Budget ceiling per dinner (₪)"
        value={budgetCeiling}
        onChangeText={setBudgetCeiling}
        keyboardType="number-pad"
        placeholder="500"
      />
      <TextField
        label="Monthly giving budget (₪)"
        value={monthlyBudget}
        onChangeText={setMonthlyBudget}
        keyboardType="number-pad"
        placeholder="2000"
      />
      <TextField
        label="Location interest"
        value={locationPref}
        onChangeText={setLocationPref}
        placeholder="Tel Aviv, Jerusalem, ..."
      />
      <Text style={styles.label}>Dinner types you care about</Text>
      <View style={styles.chipRow}>
        {DINNER_TYPE_TAGS.map((tag) => (
          <Chip key={tag} label={tag} selected={dinnerTypePrefs.includes(tag)} onPress={() => toggleTag(tag)} />
        ))}
      </View>
      <Button label="Continue" onPress={handleContinue} size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#FBEDE5",
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerText: { ...typography.caption, color: colors.brandDark },
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.lg },
  label: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.md },
});

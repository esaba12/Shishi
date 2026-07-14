import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { PhotoPicker } from "@/components/PhotoPicker";
import { colors, spacing, typography } from "@/constants/theme";
import { KOSHER_LEVELS, INTEREST_TAGS } from "@/constants/options";
import { useOnboarding } from "@/context/OnboardingContext";
import type { KosherLevel } from "@/types/database";

export default function AttendeeOnboarding() {
  const { draft, setProfile } = useOnboarding();
  const [name, setName] = useState(draft.profile.name ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(draft.profile.photoUrl ?? null);
  const [age, setAge] = useState(draft.profile.age?.toString() ?? "");
  const [gender, setGender] = useState(draft.profile.gender ?? "");
  const [origin, setOrigin] = useState(draft.profile.origin ?? "");
  const [kosherLevel, setKosherLevel] = useState<KosherLevel | null>(draft.profile.kosherLevel ?? null);
  const [dietaryPrefs, setDietaryPrefs] = useState(draft.profile.dietaryPrefs ?? "");
  const [interests, setInterests] = useState<string[]>(draft.profile.interests ?? []);
  const [funFact, setFunFact] = useState(draft.profile.funFact ?? "");

  function toggleInterest(tag: string) {
    setInterests((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function handleContinue() {
    setProfile({
      name,
      photoUrl,
      age: age ? Number(age) : null,
      gender,
      origin,
      kosherLevel,
      dietaryPrefs,
      interests,
      funFact,
    });
    if (draft.roles.includes("host")) {
      router.push("/(onboarding)/host");
    } else if (draft.roles.includes("sponsor")) {
      router.push("/(onboarding)/sponsor");
    } else {
      router.push("/(onboarding)/done");
    }
  }

  const canContinue = name.trim().length > 0 && kosherLevel !== null;

  return (
    <Screen>
      <Text style={styles.title}>Tell us about you</Text>
      <Text style={styles.subtitle}>Just the essentials \u2014 this is what helps us find your table.</Text>
      <PhotoPicker uri={photoUrl} onChange={setPhotoUrl} />
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
      <TextField label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="26" />
      <TextField label="Gender" value={gender} onChangeText={setGender} placeholder="Woman / Man / ..." />
      <TextField label="Where you're from" value={origin} onChangeText={setOrigin} placeholder="Ra'anana" />

      <Text style={styles.label}>Kosher level</Text>
      <View style={styles.chipRow}>
        {KOSHER_LEVELS.map((k) => (
          <Chip
            key={k.value}
            label={k.label}
            selected={kosherLevel === k.value}
            onPress={() => setKosherLevel(k.value)}
          />
        ))}
      </View>

      <TextField
        label="Food preferences / dietary restrictions"
        value={dietaryPrefs}
        onChangeText={setDietaryPrefs}
        placeholder="Vegetarian, nut allergy, ..."
      />

      <Text style={styles.label}>Interests</Text>
      <View style={styles.chipRow}>
        {INTEREST_TAGS.map((tag) => (
          <Chip key={tag} label={tag} selected={interests.includes(tag)} onPress={() => toggleInterest(tag)} />
        ))}
      </View>

      <TextField
        label="One fun fact"
        value={funFact}
        onChangeText={setFunFact}
        placeholder="I once hiked the entire Israel Trail."
      />

      <Button label="Continue" onPress={handleContinue} disabled={!canContinue} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  label: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.md },
});

import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/constants/theme";

export default function RequestJoin() {
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = name.trim() && organization.trim() && email.includes("@");

  if (submitted) {
    return (
      <Screen>
        <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} style={styles.icon} />
        <Text style={styles.title}>We&apos;ll be in touch.</Text>
        <Text style={styles.subtitle}>
          Your request is ready for review. A member of the Shishi team will follow up with next steps.
        </Text>
        <Button label="Return to sign in" onPress={() => router.replace("/(auth)/welcome")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Ionicons name="chatbubble-ellipses-outline" size={38} color={colors.brand} style={styles.icon} />
      <Text style={styles.eyebrow}>REQUEST ACCESS</Text>
      <Text style={styles.title}>Bring your organization into Shishi.</Text>
      <Text style={styles.subtitle}>
        Tell us a little about your team and what you want to understand. We&apos;ll help you find the right starting point.
      </Text>
      <TextField label="Your name" value={name} onChangeText={setName} placeholder="Alex Morgan" />
      <TextField label="Organization" value={organization} onChangeText={setOrganization} placeholder="Your institution" />
      <TextField label="Work email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="alex@organization.org" />
      <TextField label="Your role" value={role} onChangeText={setRole} placeholder="Planning, operations, leadership..." />
      <TextField
        label="What would you like to explore?"
        value={message}
        onChangeText={setMessage}
        placeholder="A sentence or two is enough"
        multiline
        numberOfLines={4}
        style={styles.message}
      />
      <Button label="Send request" onPress={() => setSubmitted(true)} disabled={!canSubmit} />
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { marginBottom: spacing.md },
  eyebrow: { ...typography.label, color: colors.brand, marginBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  message: { minHeight: 100, textAlignVertical: "top" },
});

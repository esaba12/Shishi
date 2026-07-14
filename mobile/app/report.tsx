import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/constants/theme";
import { createReport } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Report() {
  const params = useLocalSearchParams<{
    targetType?: "profile" | "dinner";
    targetId?: string;
    label?: string;
  }>();
  const { profile } = useAuth();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!profile || !reason.trim()) return;
    setSubmitting(true);
    try {
      await createReport(
        profile.id,
        params.targetType ?? "profile",
        params.targetId ?? "general",
        reason.trim()
      );
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Screen>
        <Header title="Report submitted" />
        <Text style={styles.body}>
          Thanks for flagging this. Our team reviews every report and will follow up if we need
          more information.
        </Text>
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={params.label ? `Report ${params.label}` : "Report a concern"} />
      <Text style={styles.body}>
        Tell us what happened. Reports are reviewed by our team, and we'll act quickly on anything
        that affects safety.
      </Text>
      <TextField
        label="What's going on?"
        value={reason}
        onChangeText={setReason}
        multiline
        numberOfLines={5}
        style={{ minHeight: 110, textAlignVertical: "top" }}
        placeholder="Describe the issue..."
      />
      <Button label="Submit report" onPress={handleSubmit} loading={submitting} disabled={!reason.trim()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
});

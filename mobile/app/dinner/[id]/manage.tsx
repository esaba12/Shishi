import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { fetchRsvpsForDinner, updateRsvpStatus, type DinnerRsvp } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/env";

export default function ManageDinner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rsvps, setRsvps] = useState<DinnerRsvp[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRsvps(await fetchRsvpsForDinner(id));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(rsvpId: string, status: "approved" | "declined") {
    await updateRsvpStatus(rsvpId, status);
    await load();
  }

  const pending = rsvps.filter((r) => r.status === "pending");
  const confirmed = rsvps.filter((r) => r.status === "approved");

  return (
    <Screen>
      <Header title="Manage guests" />

      {!isSupabaseConfigured && (
        <Text style={styles.hint}>
          Demo mode: guest requests only show up once this dinner is connected to a real Supabase
          project.
        </Text>
      )}

      <Text style={styles.sectionTitle}>Requests ({pending.length})</Text>
      {pending.length === 0 ? (
        <EmptyState title="No pending requests" />
      ) : (
        pending.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.name}>{r.attendeeName}</Text>
            <View style={styles.actions}>
              <Button label="Decline" variant="secondary" onPress={() => respond(r.id, "declined")} style={styles.actionBtn} />
              <Button label="Approve" onPress={() => respond(r.id, "approved")} style={styles.actionBtn} />
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Confirmed ({confirmed.length})</Text>
      {confirmed.length === 0 ? (
        <EmptyState title="No confirmed guests yet" />
      ) : (
        confirmed.map((r) => (
          <View key={r.id} style={styles.confirmedRow}>
            <Text style={styles.name}>{r.attendeeName}</Text>
            <Text style={styles.paid}>{r.paymentStatus === "paid" ? "Paid" : "Free"}</Text>
          </View>
        ))
      )}

      <Button
        label="Message confirmed guests"
        variant="secondary"
        onPress={() => router.push(`/messages/${id}`)}
        style={{ marginTop: spacing.lg }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, color: colors.accent, marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  name: { ...typography.bodyBold, color: colors.text, marginBottom: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionBtn: { flex: 1 },
  confirmedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paid: { ...typography.caption, color: colors.textMuted },
});

import React, { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DinnerCard } from "@/components/DinnerCard";
import { colors, spacing, typography } from "@/constants/theme";
import { fetchMyAttendingDinners, fetchMyHostedDinners, type AttendingDinner } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Dinner } from "@/types";

export default function MyDinners() {
  const { profile } = useAuth();
  const isHost = profile?.roles.includes("host");
  const [tab, setTab] = useState<"attending" | "hosting">("attending");
  const [attending, setAttending] = useState<AttendingDinner[]>([]);
  const [hosted, setHosted] = useState<Dinner[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [a, h] = await Promise.all([
        fetchMyAttendingDinners(profile.id),
        isHost ? fetchMyHostedDinners(profile.id) : Promise.resolve([]),
      ]);
      setAttending(a);
      setHosted(h);
    } finally {
      setLoading(false);
    }
  }, [profile, isHost]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>My Dinners</Text>
        {isHost && (
          <View style={styles.tabRow}>
            <Chip label="Attending" selected={tab === "attending"} onPress={() => setTab("attending")} />
            <Chip label="Hosting" selected={tab === "hosting"} onPress={() => setTab("hosting")} />
          </View>
        )}
        {isHost && tab === "hosting" && (
          <Button label="+ New dinner" variant="secondary" onPress={() => router.push("/dinner/create")} />
        )}
      </View>

      {tab === "attending" ? (
        <FlatList
          data={attending}
          keyExtractor={(item) => item.dinner.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={load}
          renderItem={({ item }) => (
            <DinnerCard dinner={item.dinner} onPress={() => router.push(`/dinner/${item.dinner.id}`)} />
          )}
          ListEmptyComponent={
            !loading ? (
              <EmptyState title="No RSVPs yet" description="Browse Discover to find your first table." />
            ) : null
          }
        />
      ) : (
        <FlatList
          data={hosted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={load}
          renderItem={({ item }) => (
            <DinnerCard dinner={item} onPress={() => router.push(`/dinner/${item.id}/manage`)} />
          )}
          ListEmptyComponent={
            !loading ? (
              <EmptyState title="You haven't hosted yet" description="Create your first dinner to get started." />
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.md },
  tabRow: { flexDirection: "row", marginBottom: spacing.sm },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});

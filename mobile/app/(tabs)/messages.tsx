import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { fetchThreads } from "@/lib/api";
import { subscribeToMyThreads } from "@/lib/realtime";
import { useAuth } from "@/context/AuthContext";
import type { MessageThread } from "@/types";

export default function Messages() {
  const { profile } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      setThreads(await fetchThreads(profile.id));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!profile) return;
    const unsubscribe = subscribeToMyThreads(profile.id, load);
    return unsubscribe;
  }, [profile, load]);

  return (
    <Screen scroll={false} padded={false}>
      <Text style={styles.title}>Messages</Text>
      <FlatList
        data={threads}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={load}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push({ pathname: "/messages/[dinnerId]", params: { dinnerId: item.dinnerId, with: item.counterpartId } })}
          >
            <View style={styles.avatar}>
              {item.counterpartPhotoUrl ? (
                <Image source={{ uri: item.counterpartPhotoUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>{item.counterpartName.charAt(0)}</Text>
              )}
            </View>
            <View style={styles.content}>
              <Text style={styles.name}>{item.counterpartName}</Text>
              <Text style={styles.preview} numberOfLines={1}>
                {item.lastMessage}
              </Text>
            </View>
            {item.unread && <View style={styles.unreadDot} />}
          </Pressable>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="No conversations yet"
              description="Messages unlock once a host approves your RSVP, or a guest joins your dinner."
            />
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.textPrimary, marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: { color: colors.onBrand, fontWeight: "700" },
  content: { flex: 1 },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  preview: { ...typography.caption, color: colors.textSecondary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
});

import React, { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Header } from "@/components/ui/Header";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { fetchDinner, fetchMessages, sendMessage } from "@/lib/api";
import { subscribeToDinnerMessages } from "@/lib/realtime";
import { useAuth } from "@/context/AuthContext";
import type { ChatMessage, Dinner } from "@/types";

export default function Thread() {
  // `with` identifies the counterpart (the other side of this specific conversation) — a dinner can
  // host several independent threads (multiple approved attendees, or a host and a sponsor), so
  // dinnerId alone no longer identifies which one this screen is showing (see lib/threadKey.ts).
  const { dinnerId, with: counterpartId } = useLocalSearchParams<{ dinnerId: string; with: string }>();
  const { profile } = useAuth();
  const [dinner, setDinner] = useState<Dinner | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const [d, msgs] = await Promise.all([fetchDinner(dinnerId), fetchMessages(dinnerId, counterpartId)]);
    setDinner(d);
    setMessages(msgs);
  }, [dinnerId, counterpartId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = subscribeToDinnerMessages(dinnerId, counterpartId, (message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    });
    return unsubscribe;
  }, [dinnerId, counterpartId]);

  async function handleSend() {
    if (!body.trim() || !profile) return;
    setSending(true);
    try {
      await sendMessage(dinnerId, profile.id, counterpartId, body.trim());
      setBody("");
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen scroll={false}>
      <Header title={dinner ? `${dinner.hostName}'s Shabbat` : "Conversation"} />
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.list}
        renderItem={({ item }) => {
          const mine = item.senderId === profile?.id;
          return (
            <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.composer}>
        <TextField
          value={body}
          onChangeText={setBody}
          placeholder="Type a message..."
          style={styles.input}
        />
        <Button label="Send" onPress={handleSend} loading={sending} disabled={!body.trim()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, paddingHorizontal: spacing.lg },
  bubbleRow: { flexDirection: "row", marginBottom: spacing.sm },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "78%",
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bubbleMine: { backgroundColor: colors.brand },
  bubbleText: { ...typography.body, color: colors.textPrimary },
  bubbleTextMine: { color: colors.onBrand },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  input: { flex: 1, marginBottom: 0 },
});

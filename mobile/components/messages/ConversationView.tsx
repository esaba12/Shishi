import React, { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { Header } from "@/components/ui/Header";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { colors, radii, spacing, typography } from "@/constants/theme";
import { fetchDinner, fetchMessages, sendMessage } from "@/lib/api";
import { subscribeToDinnerMessages } from "@/lib/realtime";
import { useAuth } from "@/context/AuthContext";
import type { ChatMessage, Dinner } from "@/types";

interface ConversationViewProps {
  dinnerId: string;
  counterpartId: string;
  /** Mobile pushes this as its own screen (wants the back-chevron Header); the desktop split embeds
   *  it inline next to the thread list, where a back button doesn't make sense. */
  showBackHeader?: boolean;
  onBack?: () => void;
}

/** The message thread itself — list + composer. Shared by the standalone mobile route
 *  (app/messages/[dinnerId].tsx) and the desktop split view (MessagesDesktopLayout), so the two
 *  presentations can never drift out of sync on how sending/receiving actually works. */
export function ConversationView({ dinnerId, counterpartId, showBackHeader = true, onBack }: ConversationViewProps) {
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

  const title = dinner ? `${dinner.hostName}'s Shabbat` : "Conversation";

  return (
    <View style={styles.flex}>
      {showBackHeader ? (
        <View style={styles.headerPadded}>
          <Header title={title} onBack={onBack} />
        </View>
      ) : (
        <View style={styles.inlineHeader}>
          <Text style={styles.inlineHeaderText} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
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
        <TextField value={body} onChangeText={setBody} placeholder="Type a message..." style={styles.input} />
        <Button label="Send" onPress={handleSend} loading={sending} disabled={!body.trim()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerPadded: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  inlineHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inlineHeaderText: { ...typography.h3, color: colors.textPrimary },
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
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
    paddingVertical: spacing.md,
  },
  input: { flex: 1, marginBottom: 0 },
});

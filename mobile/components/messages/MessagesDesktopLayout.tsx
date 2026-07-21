import React, { useEffect, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConversationView } from "@/components/messages/ConversationView";
import { colors, radii, spacing, typography } from "@/constants/theme";
import type { MessageThread } from "@/types";

interface MessagesDesktopLayoutProps {
  threads: MessageThread[];
  loading: boolean;
  onRefresh: () => void;
}

/** Desktop-only persistent split (mirrors DiscoverDesktopLayout): a thread list column beside the
 *  open conversation, so messaging on wide viewports reads like an actual desktop mail/chat client
 *  instead of a phone screen stretched into a narrow centered column with a full navigation away per
 *  thread. Mobile/tablet keep the push-to-a-new-screen flow in app/messages/[dinnerId].tsx. */
export function MessagesDesktopLayout({ threads, loading, onRefresh }: MessagesDesktopLayoutProps) {
  const [selected, setSelected] = useState<MessageThread | null>(null);

  // Keep the open thread in sync if a refresh changes/removes it; auto-select the first thread once
  // the list first loads so the right pane isn't empty by default.
  useEffect(() => {
    if (selected) {
      const stillThere = threads.find((t) => t.id === selected.id);
      if (stillThere && stillThere !== selected) setSelected(stillThere);
      return;
    }
    if (threads.length > 0) setSelected(threads[0]);
  }, [threads, selected]);

  return (
    <View style={styles.split}>
      <View style={styles.listColumn}>
        <Text style={styles.title}>Messages</Text>
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={onRefresh}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, selected?.id === item.id && styles.rowSelected]}
              onPress={() => setSelected(item)}
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
      </View>
      <View style={styles.conversationColumn}>
        {selected ? (
          <ConversationView dinnerId={selected.dinnerId} counterpartId={selected.counterpartId} showBackHeader={false} />
        ) : (
          <View style={styles.emptyPane}>
            <EmptyState title="Select a conversation" description="Pick a thread on the left to read and reply." />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: "row" },
  listColumn: {
    width: 360,
    borderEndWidth: 1,
    borderEndColor: colors.border,
  },
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
  rowSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
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
  conversationColumn: { flex: 1 },
  emptyPane: { flex: 1, alignItems: "center", justifyContent: "center" },
});

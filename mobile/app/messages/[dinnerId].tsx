import React from "react";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { ConversationView } from "@/components/messages/ConversationView";

export default function Thread() {
  // `with` identifies the counterpart (the other side of this specific conversation) — a dinner can
  // host several independent threads (multiple approved attendees, or a host and a sponsor), so
  // dinnerId alone no longer identifies which one this screen is showing (see lib/threadKey.ts).
  const { dinnerId, with: counterpartId } = useLocalSearchParams<{ dinnerId: string; with: string }>();

  return (
    <Screen scroll={false} padded={false}>
      <ConversationView dinnerId={dinnerId} counterpartId={counterpartId} />
    </Screen>
  );
}

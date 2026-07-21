import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import type { ChatMessage } from "@/types";

// Both subscribers no-op (return a dummy unsubscribe) when Supabase isn't configured, so demo mode
// keeps working exactly as before — poll-on-action via load() in the calling screens — without
// scattering isSupabaseConfigured checks through every component that wants live updates.
const NOOP_UNSUBSCRIBE = () => {};

function rowToChatMessage(row: any): ChatMessage {
  return { id: row.id, senderId: row.sender_id, body: row.body, createdAt: row.created_at };
}

/** Live updates for one conversation. Postgres Changes filters only support single-column equality,
 *  so this subscribes on dinner_id and filters the counterpart match client-side in the handler —
 *  necessary since Phase 1b's thread-key fix means multiple threads can share a dinner_id. */
export function subscribeToDinnerMessages(
  dinnerId: string,
  counterpartId: string,
  onInsert: (message: ChatMessage) => void
): () => void {
  if (!isSupabaseConfigured) return NOOP_UNSUBSCRIBE;

  const channel = supabase
    .channel(`messages:${dinnerId}:${counterpartId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `dinner_id=eq.${dinnerId}` },
      (payload) => {
        const row = payload.new as any;
        if (row.sender_id !== counterpartId && row.recipient_id !== counterpartId) return;
        onInsert(rowToChatMessage(row));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Live thread-list refresh: any message where I'm sender or recipient triggers onChange, which
 *  callers use to re-run fetchThreads() (cheaper to refetch the small thread list than to try to
 *  patch it in place from a raw message row). */
export function subscribeToMyThreads(profileId: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return NOOP_UNSUBSCRIBE;

  const channel = supabase
    .channel(`threads:${profileId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `sender_id=eq.${profileId}` },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${profileId}` },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

import { supabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { mockDinners, mockMessages, mockRsvps, mockThreads } from "@/data/mock";
import type { ApprovalMode, KosherLevel } from "@/types/database";
import type { ChatMessage, Dinner, MessageThread, Profile, Role } from "@/types";

/** Hours before a dinner's start time that the exact address becomes visible to confirmed attendees. */
export const ADDRESS_REVEAL_HOURS_BEFORE = 24;

export function isAddressRevealed(dinner: Pick<Dinner, "date" | "startTime">): boolean {
  const start = new Date(`${dinner.date}T${dinner.startTime}:00`);
  const hoursUntilStart = (start.getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntilStart <= ADDRESS_REVEAL_HOURS_BEFORE;
}

function rowToDinner(row: any): Dinner {
  const host = row.host ?? {};
  const hostDetails = host.host_details?.[0] ?? host.host_details ?? {};
  return {
    id: row.id,
    hostId: row.host_id,
    hostName: host.name ?? "Host",
    hostPhotoUrl: host.photo_url ?? null,
    hostDinnersHostedCount: hostDetails.dinners_hosted_count ?? 0,
    date: row.date,
    startTime: row.start_time?.slice(0, 5) ?? row.start_time,
    capacity: row.capacity,
    seatsTaken: row.seats_taken ?? 0,
    area: row.area,
    exactAddress: row.exact_address ?? null,
    kosherLevel: row.kosher_level,
    costPerHead: Number(row.cost_per_head ?? 0),
    isFree: row.is_free,
    description: row.description,
    approvalMode: row.approval_mode,
    budgetNeeded: row.budget_needed,
    seekingSponsorship: row.seeking_sponsorship,
    status: row.status,
  };
}

export interface DinnerFilters {
  kosherLevel?: KosherLevel;
  dateFrom?: string;
}

export async function fetchDinners(filters: DinnerFilters = {}): Promise<Dinner[]> {
  if (!isSupabaseConfigured) {
    return mockDinners.filter((d) => !filters.kosherLevel || d.kosherLevel === filters.kosherLevel);
  }
  let query = supabase
    .from("dinners")
    .select("*, host:profiles!dinners_host_id_fkey(name, photo_url, host_details(dinners_hosted_count))")
    .eq("status", "published")
    .order("date", { ascending: true });
  if (filters.kosherLevel) query = query.eq("kosher_level", filters.kosherLevel);
  if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToDinner);
}

export async function fetchDinner(id: string): Promise<Dinner | null> {
  if (!isSupabaseConfigured) {
    return mockDinners.find((d) => d.id === id) ?? null;
  }
  const { data, error } = await supabase
    .from("dinners")
    .select("*, host:profiles!dinners_host_id_fkey(name, photo_url, host_details(dinners_hosted_count))")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToDinner(data) : null;
}

export interface AttendingDinner {
  dinner: Dinner;
  rsvpStatus: string;
}

export async function fetchMyAttendingDinners(attendeeId: string): Promise<AttendingDinner[]> {
  if (!isSupabaseConfigured) {
    return Object.entries(mockRsvps).map(([dinnerId, rsvp]) => ({
      dinner: mockDinners.find((d) => d.id === dinnerId)!,
      rsvpStatus: rsvp.status,
    })).filter((entry) => entry.dinner);
  }
  const { data, error } = await supabase
    .from("rsvps")
    .select(
      "status, dinner:dinners(*, host:profiles!dinners_host_id_fkey(name, photo_url, host_details(dinners_hosted_count)))"
    )
    .eq("attendee_id", attendeeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .filter((row) => row.dinner)
    .map((row) => ({ dinner: rowToDinner(row.dinner), rsvpStatus: row.status }));
}

export async function fetchMyHostedDinners(hostId: string): Promise<Dinner[]> {
  if (!isSupabaseConfigured) {
    return mockDinners.filter((d) => d.hostId === hostId);
  }
  const { data, error } = await supabase
    .from("dinners")
    .select("*, host:profiles!dinners_host_id_fkey(name, photo_url, host_details(dinners_hosted_count))")
    .eq("host_id", hostId)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToDinner);
}

export interface CreateDinnerInput {
  hostId: string;
  date: string;
  startTime: string;
  capacity: number;
  area: string;
  exactAddress: string;
  kosherLevel: KosherLevel;
  costPerHead: number;
  isFree: boolean;
  description: string;
  approvalMode: ApprovalMode;
  budgetNeeded: number | null;
  seekingSponsorship: boolean;
}

export async function createDinner(input: CreateDinnerInput): Promise<Dinner> {
  if (!isSupabaseConfigured) {
    const dinner: Dinner = {
      id: `mock-${Date.now()}`,
      hostId: input.hostId,
      hostName: "You",
      hostPhotoUrl: null,
      hostDinnersHostedCount: 0,
      date: input.date,
      startTime: input.startTime,
      capacity: input.capacity,
      seatsTaken: 0,
      area: input.area,
      exactAddress: input.exactAddress,
      kosherLevel: input.kosherLevel,
      costPerHead: input.costPerHead,
      isFree: input.isFree,
      description: input.description,
      approvalMode: input.approvalMode,
      budgetNeeded: input.budgetNeeded,
      // Always stored as false while the sponsor pillar is dormant, regardless of the
      // (disabled) toggle value, so no MVP dinner accidentally enters a live donor feed later
      // without a deliberate migration step.
      seekingSponsorship: false,
      status: "published",
    };
    mockDinners.unshift(dinner);
    return dinner;
  }
  const { data, error } = await supabase
    .from("dinners")
    .insert({
      host_id: input.hostId,
      date: input.date,
      start_time: input.startTime,
      capacity: input.capacity,
      area: input.area,
      exact_address: input.exactAddress,
      kosher_level: input.kosherLevel,
      cost_per_head: input.costPerHead,
      is_free: input.isFree,
      description: input.description,
      approval_mode: input.approvalMode,
      budget_needed: input.budgetNeeded,
      seeking_sponsorship: false,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToDinner(data);
}

export async function fetchMyRsvpForDinner(
  dinnerId: string,
  attendeeId: string
): Promise<{ status: string; paymentStatus: string } | null> {
  if (!isSupabaseConfigured) return mockRsvps[dinnerId] ?? null;
  const { data, error } = await supabase
    .from("rsvps")
    .select("status, payment_status")
    .eq("dinner_id", dinnerId)
    .eq("attendee_id", attendeeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { status: data.status, paymentStatus: data.payment_status };
}

export async function createRsvp(
  dinnerId: string,
  attendeeId: string,
  opts: { paid: boolean; autoApprove: boolean }
): Promise<void> {
  if (!isSupabaseConfigured) {
    mockRsvps[dinnerId] = {
      status: opts.autoApprove ? "approved" : "pending",
      paymentStatus: opts.paid ? "paid" : "not_required",
    };
    const dinner = mockDinners.find((d) => d.id === dinnerId);
    if (dinner) dinner.seatsTaken += 1;
    return;
  }
  const { error } = await supabase.from("rsvps").insert({
    dinner_id: dinnerId,
    attendee_id: attendeeId,
    status: opts.autoApprove ? "approved" : "pending",
    payment_status: opts.paid ? "paid" : "not_required",
  });
  if (error) throw error;
}

export async function createPaymentIntent(dinnerId: string): Promise<{ clientSecret: string }> {
  if (!isSupabaseConfigured) {
    // Demo mode: simulate a client secret so the Stripe sheet UI can be previewed;
    // real charge creation requires the create-payment-intent Edge Function + a Supabase project.
    return { clientSecret: "demo_client_secret" };
  }
  const { data, error } = await supabase.functions.invoke("create-payment-intent", {
    body: { dinnerId },
  });
  if (error) throw error;
  return data;
}

export interface DinnerRsvp {
  id: string;
  attendeeId: string;
  attendeeName: string;
  attendeePhotoUrl: string | null;
  status: string;
  paymentStatus: string;
}

export async function fetchRsvpsForDinner(dinnerId: string): Promise<DinnerRsvp[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("rsvps")
    .select("id, status, payment_status, attendee_id, attendee:profiles!rsvps_attendee_id_fkey(name, photo_url)")
    .eq("dinner_id", dinnerId);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    attendeeId: row.attendee_id,
    attendeeName: row.attendee?.name ?? "Guest",
    attendeePhotoUrl: row.attendee?.photo_url ?? null,
    status: row.status,
    paymentStatus: row.payment_status,
  }));
}

export async function updateRsvpStatus(rsvpId: string, status: "approved" | "declined"): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("rsvps").update({ status }).eq("id", rsvpId);
  if (error) throw error;
}

export async function fetchThreads(profileId: string): Promise<MessageThread[]> {
  if (!isSupabaseConfigured) return mockThreads;
  const { data, error } = await supabase
    .from("messages")
    .select("*, dinner:dinners(description), sender:profiles!messages_sender_id_fkey(name, photo_url)")
    .or(`sender_id.eq.${profileId},recipient_id.eq.${profileId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  // Collapse to one thread per dinner+counterpart for MVP simplicity.
  const seen = new Set<string>();
  const threads: MessageThread[] = [];
  for (const row of data ?? []) {
    const key = row.dinner_id;
    if (seen.has(key)) continue;
    seen.add(key);
    threads.push({
      id: row.dinner_id,
      dinnerId: row.dinner_id,
      dinnerTitle: row.dinner?.description?.slice(0, 40) ?? "Dinner",
      counterpartName: row.sender?.name ?? "Guest",
      counterpartPhotoUrl: row.sender?.photo_url ?? null,
      lastMessage: row.body,
      lastMessageAt: row.created_at,
      unread: false,
    });
  }
  return threads;
}

export async function fetchMessages(dinnerId: string): Promise<ChatMessage[]> {
  if (!isSupabaseConfigured) return mockMessages[dinnerId] ?? [];
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("dinner_id", dinnerId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    body: m.body,
    createdAt: m.created_at,
  }));
}

export async function sendMessage(
  dinnerId: string,
  senderId: string,
  recipientId: string,
  body: string
): Promise<void> {
  if (!isSupabaseConfigured) {
    mockMessages[dinnerId] = [
      ...(mockMessages[dinnerId] ?? []),
      { id: `m-${Date.now()}`, senderId, body, createdAt: new Date().toISOString() },
    ];
    return;
  }
  const { error } = await supabase
    .from("messages")
    .insert({ dinner_id: dinnerId, sender_id: senderId, recipient_id: recipientId, body });
  if (error) throw error;
}

export async function createReport(
  reporterId: string,
  targetType: "profile" | "dinner",
  targetId: string,
  reason: string
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from("reports")
    .insert({ reporter_id: reporterId, target_type: targetType, target_id: targetId, reason });
  if (error) throw error;
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const roles: Role[] = [];
  if (data.is_attendee) roles.push("attendee");
  if (data.is_host) roles.push("host");
  if (data.is_sponsor) roles.push("sponsor");
  return {
    id: data.id,
    name: data.name,
    photoUrl: data.photo_url,
    age: data.age,
    gender: data.gender,
    origin: data.origin,
    kosherLevel: data.kosher_level,
    dietaryPrefs: data.dietary_prefs,
    interests: data.interests ?? [],
    funFact: data.fun_fact,
    roles,
    verificationTier: data.verification_tier,
  };
}

import { supabase } from "@/lib/supabase";
import { isDemoSessionActive, isSupabaseConfigured } from "@/lib/env";
import { threadKey } from "@/lib/threadKey";
import {
  mockDinners,
  mockDonations,
  mockMessages,
  mockPotluckItems,
  mockRsvps,
  mockThreads,
} from "@/data/mock";
import type { ApprovalMode, KosherLevel, PotluckCategory } from "@/types/database";
import type {
  ChatMessage,
  Dinner,
  MessageThread,
  PotluckClaim,
  PotluckItem,
  Profile,
  Role,
  SponsorDonation,
} from "@/types";

/** Hours before a dinner's start time that the exact address becomes visible to confirmed attendees.
 *  Mirrored server-side in the `get_dinner_address` Postgres function (supabase/schema.sql) as the
 *  interval that actually gates the RPC — intentionally duplicated, not derived from one source. */
export const ADDRESS_REVEAL_HOURS_BEFORE = 24;

// A demo session never authenticates against real Supabase Auth, so it can't pass RLS even when a
// project is connected — route it to mock data the same way an unconfigured project would be.
function useMockData(): boolean {
  return !isSupabaseConfigured || isDemoSessionActive();
}

export function isAddressRevealed(dinner: Pick<Dinner, "date" | "startTime">): boolean {
  const start = new Date(`${dinner.date}T${dinner.startTime}:00`);
  const hoursUntilStart = (start.getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntilStart <= ADDRESS_REVEAL_HOURS_BEFORE;
}

// exact_address is deliberately excluded: the DB revokes wildcard column access to it (see
// schema.sql), so a `select("*")` would error and a `select` naming it would just come back null for
// anyone who isn't the host of an already-passed RLS row filter. fetchDinnerAddress() below, via the
// get_dinner_address RPC, is the only way to actually read it.
const DINNER_COLUMNS =
  "id, host_id, date, start_time, capacity, area, kosher_level, cost_per_head, is_free, description, " +
  "approval_mode, budget_needed, seeking_sponsorship, dinner_type_tags, sponsor_approved, " +
  "amount_funded, status, created_at";
const DINNER_SELECT = `${DINNER_COLUMNS}, host:profiles!dinners_host_id_fkey(name, photo_url, host_details(dinners_hosted_count))`;

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
    dinnerTypeTags: row.dinner_type_tags ?? [],
    sponsorApproved: row.sponsor_approved ?? false,
    amountFunded: Number(row.amount_funded ?? 0),
    status: row.status,
  };
}

/** The only path to a dinner's real address once Supabase is configured — enforces the
 *  host-or-approved-and-past-reveal-window rule server-side via the get_dinner_address RPC. In demo
 *  mode there's no RLS to bypass, so callers should keep reading dinner.exactAddress directly. */
export async function fetchDinnerAddress(dinnerId: string): Promise<string | null> {
  if (useMockData()) return null;
  const { data, error } = await supabase.rpc("get_dinner_address", { p_dinner_id: dinnerId });
  if (error) throw error;
  return data ?? null;
}

export interface DinnerFilters {
  kosherLevel?: KosherLevel;
  dateFrom?: string;
}

export async function fetchDinners(filters: DinnerFilters = {}): Promise<Dinner[]> {
  if (useMockData()) {
    return mockDinners.filter((d) => !filters.kosherLevel || d.kosherLevel === filters.kosherLevel);
  }
  let query = supabase
    .from("dinners")
    .select(DINNER_SELECT)
    .eq("status", "published")
    .order("date", { ascending: true });
  if (filters.kosherLevel) query = query.eq("kosher_level", filters.kosherLevel);
  if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToDinner);
}

export async function fetchDinner(id: string): Promise<Dinner | null> {
  if (useMockData()) {
    return mockDinners.find((d) => d.id === id) ?? null;
  }
  const { data, error } = await supabase
    .from("dinners")
    .select(DINNER_SELECT)
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
  if (useMockData()) {
    return Object.entries(mockRsvps).map(([dinnerId, rsvp]) => ({
      dinner: mockDinners.find((d) => d.id === dinnerId)!,
      rsvpStatus: rsvp.status,
    })).filter((entry) => entry.dinner);
  }
  const { data, error } = await supabase
    .from("rsvps")
    .select(`status, dinner:dinners(${DINNER_SELECT})`)
    .eq("attendee_id", attendeeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .filter((row) => row.dinner)
    .map((row) => ({ dinner: rowToDinner(row.dinner), rsvpStatus: row.status }));
}

export async function fetchMyHostedDinners(hostId: string): Promise<Dinner[]> {
  if (useMockData()) {
    return mockDinners.filter((d) => d.hostId === hostId);
  }
  const { data, error } = await supabase
    .from("dinners")
    .select(DINNER_SELECT)
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
  dinnerTypeTags: string[];
}

export async function createDinner(input: CreateDinnerInput): Promise<Dinner> {
  if (useMockData()) {
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
      seekingSponsorship: input.seekingSponsorship,
      dinnerTypeTags: input.dinnerTypeTags,
      // A real host approval workflow gate (product bible §8/§10) — a dinner only enters the donor
      // feed once a human flips this via Supabase Studio. Demo mode auto-approves so the sponsor
      // feed isn't empty for anyone clicking through without a backend.
      sponsorApproved: input.seekingSponsorship,
      amountFunded: 0,
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
      seeking_sponsorship: input.seekingSponsorship,
      dinner_type_tags: input.dinnerTypeTags,
    })
    .select(DINNER_SELECT)
    .single();
  if (error) throw error;
  return rowToDinner(data);
}

export async function fetchMyRsvpForDinner(
  dinnerId: string,
  attendeeId: string
): Promise<{ status: string; paymentStatus: string } | null> {
  if (useMockData()) return mockRsvps[dinnerId] ?? null;
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
  if (useMockData()) {
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
  if (useMockData()) {
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
  if (useMockData()) return [];
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
  if (useMockData()) return;
  const { error } = await supabase.from("rsvps").update({ status }).eq("id", rsvpId);
  if (error) throw error;
}

function rowToPotluckClaim(row: any): PotluckClaim {
  return {
    id: row.id,
    itemId: row.item_id,
    attendeeId: row.attendee_id,
    attendeeName: row.attendee?.name ?? "Guest",
    attendeePhotoUrl: row.attendee?.photo_url ?? null,
    quantity: row.quantity,
    contributionAmount: row.contribution_amount != null ? Number(row.contribution_amount) : null,
    note: row.note ?? null,
    createdAt: row.created_at,
  };
}

function rowToPotluckItem(row: any): PotluckItem {
  return {
    id: row.id,
    dinnerId: row.dinner_id,
    name: row.name,
    category: row.category,
    quantityNeeded: row.quantity_needed,
    isMoneyRequest: row.is_money_request,
    moneyAmount: row.money_amount != null ? Number(row.money_amount) : null,
    notes: row.notes ?? null,
    claims: (row.claims ?? []).map(rowToPotluckClaim),
    createdAt: row.created_at,
  };
}

/** Checklist for a dinner's potluck contributions, with each item's claims attached. Visible to
 *  anyone who can see the dinner; RLS narrows which *claims* (names) come back per §5.7/§8 — only
 *  the host, the claimant, and already-approved guests see who claimed what. */
export async function fetchPotluckItems(dinnerId: string): Promise<PotluckItem[]> {
  if (useMockData()) {
    return mockPotluckItems[dinnerId] ?? [];
  }
  const { data, error } = await supabase
    .from("potluck_items")
    .select("*, claims:potluck_claims(*, attendee:profiles!potluck_claims_attendee_id_fkey(name, photo_url))")
    .eq("dinner_id", dinnerId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToPotluckItem);
}

export interface CreatePotluckItemInput {
  dinnerId: string;
  name: string;
  category: PotluckCategory;
  quantityNeeded: number;
  isMoneyRequest: boolean;
  moneyAmount: number | null;
  notes: string | null;
}

/** Host-only: add a thing the dinner needs — a food/drink/supply item, or a money request for
 *  guests who'd rather chip in than bring something physical. */
export async function createPotluckItem(input: CreatePotluckItemInput): Promise<PotluckItem> {
  if (useMockData()) {
    const item: PotluckItem = {
      id: `mock-item-${Date.now()}`,
      dinnerId: input.dinnerId,
      name: input.name,
      category: input.category,
      quantityNeeded: input.quantityNeeded,
      isMoneyRequest: input.isMoneyRequest,
      moneyAmount: input.moneyAmount,
      notes: input.notes,
      claims: [],
      createdAt: new Date().toISOString(),
    };
    mockPotluckItems[input.dinnerId] = [...(mockPotluckItems[input.dinnerId] ?? []), item];
    return item;
  }
  const { data, error } = await supabase
    .from("potluck_items")
    .insert({
      dinner_id: input.dinnerId,
      name: input.name,
      category: input.category,
      quantity_needed: input.quantityNeeded,
      is_money_request: input.isMoneyRequest,
      money_amount: input.moneyAmount,
      notes: input.notes,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToPotluckItem({ ...data, claims: [] });
}

/** Host-only: remove an item from the checklist (also clears any claims against it). */
export async function deletePotluckItem(itemId: string, dinnerId: string): Promise<void> {
  if (useMockData()) {
    mockPotluckItems[dinnerId] = (mockPotluckItems[dinnerId] ?? []).filter((i) => i.id !== itemId);
    return;
  }
  const { error } = await supabase.from("potluck_items").delete().eq("id", itemId);
  if (error) throw error;
}

export interface ClaimPotluckItemInput {
  itemId: string;
  dinnerId: string;
  attendeeId: string;
  attendeeName: string;
  quantity: number;
  contributionAmount: number | null;
  note: string | null;
}

/** Attendee-only, and only once their RSVP is approved (enforced server-side too): sign up to
 *  bring an item, or pledge a contribution instead. One claim per attendee per item — calling this
 *  again updates the existing claim rather than creating a duplicate. */
export async function claimPotluckItem(input: ClaimPotluckItemInput): Promise<PotluckClaim> {
  if (useMockData()) {
    const claim: PotluckClaim = {
      id: `mock-claim-${Date.now()}`,
      itemId: input.itemId,
      attendeeId: input.attendeeId,
      attendeeName: input.attendeeName,
      attendeePhotoUrl: null,
      quantity: input.quantity,
      contributionAmount: input.contributionAmount,
      note: input.note,
      createdAt: new Date().toISOString(),
    };
    const items = mockPotluckItems[input.dinnerId] ?? [];
    const item = items.find((i) => i.id === input.itemId);
    if (item) {
      item.claims = [...item.claims.filter((c) => c.attendeeId !== input.attendeeId), claim];
    }
    return claim;
  }
  const { data, error } = await supabase
    .from("potluck_claims")
    .upsert(
      {
        item_id: input.itemId,
        attendee_id: input.attendeeId,
        quantity: input.quantity,
        contribution_amount: input.contributionAmount,
        note: input.note,
      },
      { onConflict: "item_id,attendee_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return rowToPotluckClaim({ ...data, attendee: { name: input.attendeeName } });
}

/** Attendee cancels their own claim (or a host frees it up on someone's behalf). */
export async function cancelPotluckClaim(
  claimId: string,
  dinnerId: string,
  itemId: string,
  attendeeId: string
): Promise<void> {
  if (useMockData()) {
    const items = mockPotluckItems[dinnerId] ?? [];
    const item = items.find((i) => i.id === itemId);
    if (item) item.claims = item.claims.filter((c) => c.attendeeId !== attendeeId);
    return;
  }
  const { error } = await supabase.from("potluck_claims").delete().eq("id", claimId);
  if (error) throw error;
}

export async function fetchThreads(profileId: string): Promise<MessageThread[]> {
  if (useMockData()) return mockThreads;
  const { data, error } = await supabase
    .from("messages")
    .select(
      "*, dinner:dinners(description), sender:profiles!messages_sender_id_fkey(name, photo_url), recipient:profiles!messages_recipient_id_fkey(name, photo_url)"
    )
    .or(`sender_id.eq.${profileId},recipient_id.eq.${profileId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const seen = new Set<string>();
  const threads: MessageThread[] = [];
  for (const row of data ?? []) {
    const counterpartId = row.sender_id === profileId ? row.recipient_id : row.sender_id;
    const counterpart = row.sender_id === profileId ? row.recipient : row.sender;
    const key = threadKey(row.dinner_id, counterpartId);
    if (seen.has(key)) continue;
    seen.add(key);
    threads.push({
      id: key,
      dinnerId: row.dinner_id,
      dinnerTitle: row.dinner?.description?.slice(0, 40) ?? "Dinner",
      counterpartId,
      counterpartName: counterpart?.name ?? "Guest",
      counterpartPhotoUrl: counterpart?.photo_url ?? null,
      lastMessage: row.body,
      lastMessageAt: row.created_at,
      unread: false,
    });
  }
  return threads;
}

export async function fetchMessages(dinnerId: string, counterpartId: string): Promise<ChatMessage[]> {
  if (useMockData()) return mockMessages[threadKey(dinnerId, counterpartId)] ?? [];
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("dinner_id", dinnerId)
    .or(`sender_id.eq.${counterpartId},recipient_id.eq.${counterpartId}`)
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
  if (useMockData()) {
    const key = threadKey(dinnerId, recipientId);
    mockMessages[key] = [
      ...(mockMessages[key] ?? []),
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
  if (useMockData()) return;
  const { error } = await supabase
    .from("reports")
    .insert({ reporter_id: reporterId, target_type: targetType, target_id: targetId, reason });
  if (error) throw error;
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  if (useMockData()) return null;
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

// === Sponsorship & donations ===
// Sponsor payments are donations to Shishi's nonprofit entity, earmarked for a specific dinner — not
// peer-to-peer payments to a host. One centralized Stripe account, no per-host Connect payouts (see
// supabase/functions/create-donation-intent and supabase/functions/stripe-webhook). Copy that
// surfaces this data should say "fund"/"donate," never "pay the host," and should not claim
// tax-deductibility — that requires a 501(c)(3)/"American Friends of" entity that doesn't exist yet.

export interface SponsorPrefs {
  budgetCeiling: number | null;
  locationPref: string | null;
  dinnerTypePrefs: string[];
}

/** Dinners open for sponsorship, filtered per the product bible §5.5 match rule: budget_needed must
 *  fit the sponsor's ceiling, and (when set) location/dinner-type preferences narrow the feed further.
 *  Only dinners a human has approved to receive sponsor money (sponsorApproved) are ever shown —
 *  see the schema comment on dinners.sponsor_approved. */
export async function fetchSponsorFeed(prefs: SponsorPrefs): Promise<Dinner[]> {
  const fits = (d: Dinner) => {
    if (!d.seekingSponsorship || !d.sponsorApproved || d.status !== "published") return false;
    if (d.budgetNeeded != null && d.amountFunded >= d.budgetNeeded) return false; // fully funded
    if (prefs.budgetCeiling != null && (d.budgetNeeded ?? 0) > prefs.budgetCeiling) return false;
    if (prefs.locationPref && !d.area.toLowerCase().includes(prefs.locationPref.toLowerCase())) return false;
    if (prefs.dinnerTypePrefs.length && !d.dinnerTypeTags.some((t) => prefs.dinnerTypePrefs.includes(t))) {
      return false;
    }
    return true;
  };

  if (useMockData()) {
    return mockDinners.filter(fits);
  }
  let query = supabase
    .from("dinners")
    .select(DINNER_SELECT)
    .eq("seeking_sponsorship", true)
    .eq("sponsor_approved", true)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (prefs.budgetCeiling != null) query = query.lte("budget_needed", prefs.budgetCeiling);
  if (prefs.locationPref) query = query.ilike("area", `%${prefs.locationPref}%`);
  if (prefs.dinnerTypePrefs.length) query = query.overlaps("dinner_type_tags", prefs.dinnerTypePrefs);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToDinner).filter((d) => d.budgetNeeded == null || d.amountFunded < d.budgetNeeded);
}

/** Starts a donation: mock mode fabricates a client secret and records the donation as already
 *  succeeded (matches the existing instant-success demo UX elsewhere in this file); live mode calls
 *  the create-donation-intent Edge Function, which inserts a `pending` row and creates a Stripe
 *  PaymentIntent — the row only ever flips to `succeeded` via the stripe-webhook function. */
export async function createDonationIntent(
  dinnerId: string,
  sponsorId: string,
  amount: number,
  donorLegalName: string,
  donorReceiptEmail: string,
  opts: { anonymous: boolean; message: string | null }
): Promise<{ clientSecret: string; donationId: string }> {
  if (useMockData()) {
    const dinner = mockDinners.find((d) => d.id === dinnerId);
    const donation: SponsorDonation = {
      id: `mock-donation-${Date.now()}`,
      dinnerId,
      hostId: dinner?.hostId ?? "",
      sponsorId,
      donorLegalName,
      donorReceiptEmail,
      amount,
      currency: "ils",
      status: "succeeded",
      message: opts.message,
      anonymous: opts.anonymous,
      createdAt: new Date().toISOString(),
    };
    mockDonations.unshift(donation);
    if (dinner) dinner.amountFunded += amount;
    return { clientSecret: "demo_client_secret", donationId: donation.id };
  }
  const { data, error } = await supabase.functions.invoke("create-donation-intent", {
    body: { dinnerId, amount, donorLegalName, donorReceiptEmail, ...opts },
  });
  if (error) throw error;
  return data;
}

function rowToDonation(row: any): SponsorDonation {
  return {
    id: row.id,
    dinnerId: row.dinner_id,
    hostId: row.host_id,
    sponsorId: row.sponsor_id,
    donorLegalName: row.donor_legal_name,
    donorReceiptEmail: row.donor_receipt_email,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    message: row.message,
    anonymous: row.anonymous,
    createdAt: row.created_at,
  };
}

export async function fetchMyDonations(sponsorId: string): Promise<SponsorDonation[]> {
  if (useMockData()) return mockDonations.filter((d) => d.sponsorId === sponsorId);
  const { data, error } = await supabase
    .from("sponsor_donations")
    .select("*")
    .eq("sponsor_id", sponsorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToDonation);
}

/** Donations made *to* a specific dinner — used on the dinner-detail/manage screens so a host can see
 *  who's funding them (respecting `anonymous`) and, once a donation succeeds, message the sponsor. */
export async function fetchDonationsForDinner(dinnerId: string): Promise<SponsorDonation[]> {
  if (useMockData()) return mockDonations.filter((d) => d.dinnerId === dinnerId);
  const { data, error } = await supabase
    .from("sponsor_donations")
    .select("*")
    .eq("dinner_id", dinnerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToDonation);
}

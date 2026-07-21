-- Shishi MVP schema (Attendee, Host, and Sponsor pillars all functional).
-- Run this against a fresh Supabase project (SQL Editor or `supabase db push`).


create type kosher_level as enum ('not_kosher', 'kosher', 'strictly_kosher');
create type approval_mode as enum ('auto_accept', 'host_approves');
create type dinner_status as enum ('published', 'cancelled', 'past');
create type rsvp_status as enum ('pending', 'approved', 'declined', 'cancelled');
create type payment_status as enum ('not_required', 'pending', 'paid', 'refunded');
create type sponsor_status as enum ('waitlisted', 'active');
create type report_target_type as enum ('profile', 'dinner');
create type report_status as enum ('open', 'reviewed', 'actioned');
create type potluck_category as enum ('food', 'drink', 'supplies', 'money', 'other');
-- Donations are their own lifecycle, deliberately separate from rsvps.payment_status: a donation is
-- receipt-bearing platform-nonprofit money, not a peer-to-peer host payment (see sponsor_donations
-- below), so its status is authoritative only from the Stripe webhook, never the client.
create type donation_status as enum ('pending', 'succeeded', 'failed', 'refunded');

-- One row per authenticated user (id matches auth.users.id).
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  email text,
  name text not null,
  photo_url text,
  age integer,
  gender text,
  origin text,
  kosher_level kosher_level,
  dietary_prefs text,
  interests text[] not null default '{}',
  fun_fact text,
  is_attendee boolean not null default true,
  is_host boolean not null default false,
  is_sponsor boolean not null default false,
  verification_tier integer not null default 1, -- 1 = phone+email verified (MVP tier)
  created_at timestamptz not null default now()
);

-- Extra fields only relevant once someone opts into hosting.
create table host_details (
  profile_id uuid primary key references profiles (id) on delete cascade,
  bio text,
  home_vibe text,
  dinners_hosted_count integer not null default 0
);

-- Extra fields for sponsor role. status defaults 'waitlisted' at the DB level for safety; the app
-- inserts 'active' explicitly once onboarding completes (see AuthContext.completeOnboarding).
create table sponsor_details (
  profile_id uuid primary key references profiles (id) on delete cascade,
  why_i_give text,
  budget_ceiling numeric,
  monthly_budget numeric,
  location_pref text,
  dinner_type_prefs text[] not null default '{}',
  status sponsor_status not null default 'waitlisted'
);

create table dinners (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles (id) on delete cascade,
  date date not null,
  start_time time not null,
  capacity integer not null check (capacity > 0),
  area text not null,
  exact_address text, -- withheld from attendees client-side until close to the date; column-level
                       -- select is additionally revoked below (see get_dinner_address)
  kosher_level kosher_level not null,
  cost_per_head numeric not null default 0,
  is_free boolean not null default true,
  description text not null,
  approval_mode approval_mode not null default 'host_approves',
  budget_needed numeric,
  seeking_sponsorship boolean not null default false,
  dinner_type_tags text[] not null default '{}', -- shared vocabulary with sponsor_details.dinner_type_prefs
  -- Manual fraud/values gate (product bible §8/§10): a dinner only enters the sponsor donor feed once
  -- this is flipped. No admin UI yet, per existing scope decisions — toggled via Supabase Studio.
  sponsor_approved boolean not null default false,
  amount_funded numeric not null default 0, -- maintained by update_dinner_amount_funded() trigger below
  status dinner_status not null default 'published',
  created_at timestamptz not null default now()
);

create table rsvps (
  id uuid primary key default gen_random_uuid(),
  dinner_id uuid not null references dinners (id) on delete cascade,
  attendee_id uuid not null references profiles (id) on delete cascade,
  status rsvp_status not null default 'pending',
  payment_status payment_status not null default 'not_required',
  stripe_payment_id text,
  created_at timestamptz not null default now(),
  unique (dinner_id, attendee_id)
);

-- A sponsor's donation toward a dinner's budget_needed. Deliberately its own table, not an rsvp
-- variant: different lifecycle (donation_status, webhook-authoritative — see RLS below), different
-- Stripe flow (a single centralized platform Stripe account, no per-host Connect payouts — this is a
-- donation to Shishi's nonprofit entity earmarked for a dinner, not a peer-to-peer payment to the
-- host), and receipt-shaped fields captured now even though actual 501(c)(3)/"American Friends of"
-- formation and IRS-compliant receipt issuance is a legal/business step outside this schema's scope.
create table sponsor_donations (
  id uuid primary key default gen_random_uuid(),
  dinner_id uuid not null references dinners (id) on delete cascade,
  host_id uuid not null references profiles (id) on delete cascade, -- denormalized for RLS/query convenience
  sponsor_id uuid not null references profiles (id) on delete cascade,
  donor_legal_name text not null,
  donor_receipt_email text not null,
  amount numeric not null check (amount > 0),
  currency text not null default 'ils',
  status donation_status not null default 'pending',
  stripe_payment_id text,
  message text,
  anonymous boolean not null default false, -- hides donor name from the host-facing view; legal name is still captured
  created_at timestamptz not null default now()
);

-- Potluck-style checklist: a host lists things the dinner needs (food, drinks, supplies, or a cash
-- contribution instead of a physical item); attendees sign up against the list. Money-splitting /
-- expected-value logic is intentionally out of scope here and lands in a later pass.
create table potluck_items (
  id uuid primary key default gen_random_uuid(),
  dinner_id uuid not null references dinners (id) on delete cascade,
  name text not null,
  category potluck_category not null default 'other',
  quantity_needed integer not null default 1 check (quantity_needed > 0),
  is_money_request boolean not null default false,
  money_amount numeric, -- suggested contribution when is_money_request is true
  notes text,
  created_at timestamptz not null default now()
);

create table potluck_claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references potluck_items (id) on delete cascade,
  attendee_id uuid not null references profiles (id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  contribution_amount numeric, -- amount pledged when the item is a money request
  note text,
  created_at timestamptz not null default now(),
  unique (item_id, attendee_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  dinner_id uuid not null references dinners (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  recipient_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles (id) on delete cascade,
  target_type report_target_type not null,
  target_id uuid not null,
  reason text not null,
  status report_status not null default 'open',
  reviewed_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- === Functions & triggers ===

-- Keeps dinners.amount_funded as a live sum of succeeded donations, so the sponsor feed and dinner
-- detail screens can read it directly instead of aggregating client-side on every render.
create or replace function update_dinner_amount_funded() returns trigger
language plpgsql security definer as $$
begin
  update dinners set amount_funded = (
    select coalesce(sum(amount), 0) from sponsor_donations
    where dinner_id = coalesce(new.dinner_id, old.dinner_id) and status = 'succeeded'
  ) where id = coalesce(new.dinner_id, old.dinner_id);
  return null;
end; $$;

create trigger sponsor_donations_update_funded
after insert or update or delete on sponsor_donations
for each row execute function update_dinner_amount_funded();

-- Address reveal: exact_address is not selectable directly (see the column-privilege revoke in the
-- RLS section below) — this is the only way to read it. Returns the address to the dinner's host at
-- any time, or to an attendee once their rsvp is approved AND the reveal window has opened, else
-- null. ADDRESS_REVEAL_HOURS_BEFORE in lib/api.ts must be kept in sync with the interval below —
-- they're intentionally duplicated (client-side for UI copy, server-side as the actual gate), not
-- derived from one source.
create or replace function get_dinner_address(p_dinner_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_address text;
  v_host_id uuid;
  v_reveal_at timestamptz;
  v_is_approved boolean;
begin
  select exact_address, host_id, (date + start_time - interval '24 hours')
    into v_address, v_host_id, v_reveal_at
    from dinners where id = p_dinner_id;

  if v_address is null then
    return null;
  end if;

  if auth.uid() = v_host_id then
    return v_address;
  end if;

  select exists(
    select 1 from rsvps
    where dinner_id = p_dinner_id and attendee_id = auth.uid() and status = 'approved'
  ) into v_is_approved;

  if v_is_approved and now() >= v_reveal_at then
    return v_address;
  end if;

  return null;
end; $$;

-- === Row Level Security ===
alter table profiles enable row level security;
alter table host_details enable row level security;
alter table sponsor_details enable row level security;
alter table dinners enable row level security;
alter table rsvps enable row level security;
alter table sponsor_donations enable row level security;
alter table potluck_items enable row level security;
alter table potluck_claims enable row level security;
alter table messages enable row level security;
alter table reports enable row level security;

create policy "profiles are viewable by authenticated users" on profiles
  for select using (auth.role() = 'authenticated');
create policy "users manage their own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "host details viewable by authenticated users" on host_details
  for select using (auth.role() = 'authenticated');
create policy "hosts manage their own host details" on host_details
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create policy "sponsor details owner only" on sponsor_details
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create policy "published dinners are viewable by authenticated users" on dinners
  for select using (auth.role() = 'authenticated');
create policy "hosts manage their own dinners" on dinners
  for insert with check (auth.uid() = host_id);
create policy "hosts update their own dinners" on dinners
  for update using (auth.uid() = host_id);
create policy "hosts delete their own dinners" on dinners
  for delete using (auth.uid() = host_id);

-- exact_address column-privilege lock: RLS controls row visibility, not column visibility, so the
-- "authenticated users can select dinners" policy above would otherwise leak every dinner's exact
-- address to any authenticated user regardless of RSVP status or the reveal window. Revoke wildcard
-- column access and re-grant everything except exact_address; get_dinner_address() (defined above,
-- security definer) is the only path to actually read it, and it enforces the approval+timing gate.
revoke select on dinners from authenticated, anon;
grant select (
  id, host_id, date, start_time, capacity, area, kosher_level, cost_per_head, is_free, description,
  approval_mode, budget_needed, seeking_sponsorship, dinner_type_tags, sponsor_approved,
  amount_funded, status, created_at
) on dinners to authenticated;
grant execute on function get_dinner_address(uuid) to authenticated;

create policy "attendees see their own rsvps, hosts see rsvps to their dinners" on rsvps
  for select using (
    auth.uid() = attendee_id
    or auth.uid() in (select host_id from dinners where dinners.id = rsvps.dinner_id)
  );
create policy "attendees create their own rsvps" on rsvps
  for insert with check (auth.uid() = attendee_id);
create policy "attendee or host can update an rsvp" on rsvps
  for update using (
    auth.uid() = attendee_id
    or auth.uid() in (select host_id from dinners where dinners.id = rsvps.dinner_id)
  );

create policy "sponsor sees own donations, host sees donations to their dinners" on sponsor_donations
  for select using (auth.uid() = sponsor_id or auth.uid() = host_id);
create policy "sponsor creates their own donation" on sponsor_donations
  for insert with check (auth.uid() = sponsor_id);
-- Deliberately no update/delete policy for authenticated users: status transitions to
-- succeeded/failed/refunded happen only via the stripe-webhook edge function using the service-role
-- key, which bypasses RLS entirely. Stricter than rsvps.payment_status (client-set) on purpose,
-- since real donor money and a future tax receipt are on the line here.

create policy "potluck items are viewable by authenticated users" on potluck_items
  for select using (auth.role() = 'authenticated');
create policy "hosts add items to their own dinners" on potluck_items
  for insert with check (auth.uid() in (select host_id from dinners where dinners.id = potluck_items.dinner_id));
create policy "hosts update items on their own dinners" on potluck_items
  for update using (auth.uid() in (select host_id from dinners where dinners.id = potluck_items.dinner_id));
create policy "hosts delete items on their own dinners" on potluck_items
  for delete using (auth.uid() in (select host_id from dinners where dinners.id = potluck_items.dinner_id));

-- Claims reveal who is bringing/pledging what, so visibility mirrors the contact-exchange rule
-- (§5.7/§8 of the product bible): the claimant, the host, and guests already approved for the
-- dinner can see them; a claim can only be made once an attendee's RSVP is approved.
create policy "claim visible to claimant, host, or approved dinner guests" on potluck_claims
  for select using (
    auth.uid() = attendee_id
    or auth.uid() in (
      select d.host_id from potluck_items i join dinners d on d.id = i.dinner_id
      where i.id = potluck_claims.item_id
    )
    or auth.uid() in (
      select r.attendee_id from rsvps r join potluck_items i on i.dinner_id = r.dinner_id
      where i.id = potluck_claims.item_id and r.status = 'approved'
    )
  );
create policy "approved attendees can claim potluck items" on potluck_claims
  for insert with check (
    auth.uid() = attendee_id
    and auth.uid() in (
      select r.attendee_id from rsvps r join potluck_items i on i.dinner_id = r.dinner_id
      where i.id = potluck_claims.item_id and r.status = 'approved'
    )
  );
create policy "attendee updates their own claim" on potluck_claims
  for update using (auth.uid() = attendee_id);
create policy "attendee or host can remove a claim" on potluck_claims
  for delete using (
    auth.uid() = attendee_id
    or auth.uid() in (
      select d.host_id from potluck_items i join dinners d on d.id = i.dinner_id
      where i.id = potluck_claims.item_id
    )
  );

create policy "participants can read their messages" on messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "participants can send messages" on messages
  for insert with check (auth.uid() = sender_id);

create policy "users can create reports" on reports
  for insert with check (auth.uid() = reporter_id);
create policy "users can view their own reports" on reports
  for select using (auth.uid() = reporter_id);

-- === Realtime ===
-- Powers subscribeToDinnerMessages/subscribeToMyThreads in lib/realtime.ts.
alter publication supabase_realtime add table messages;

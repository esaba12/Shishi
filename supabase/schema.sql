-- Shishi MVP schema (Attendee + Host pillars functional, Sponsor pillar dormant).
-- Run this against a fresh Supabase project (SQL Editor or `supabase db push`).

create extension if not exists "uuid-ossp";

create type kosher_level as enum ('not_kosher', 'kosher', 'strictly_kosher');
create type approval_mode as enum ('auto_accept', 'host_approves');
create type dinner_status as enum ('published', 'cancelled', 'past');
create type rsvp_status as enum ('pending', 'approved', 'declined', 'cancelled');
create type payment_status as enum ('not_required', 'pending', 'paid', 'refunded');
create type sponsor_status as enum ('waitlisted', 'active');
create type report_target_type as enum ('profile', 'dinner');
create type report_status as enum ('open', 'reviewed', 'actioned');
create type potluck_category as enum ('food', 'drink', 'supplies', 'money', 'other');

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

-- Extra fields for sponsor role. Feature is dormant in MVP; status starts 'waitlisted'.
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
  id uuid primary key default uuid_generate_v4(),
  host_id uuid not null references profiles (id) on delete cascade,
  date date not null,
  start_time time not null,
  capacity integer not null check (capacity > 0),
  area text not null,
  exact_address text, -- withheld from attendees client-side until close to the date
  kosher_level kosher_level not null,
  cost_per_head numeric not null default 0,
  is_free boolean not null default true,
  description text not null,
  approval_mode approval_mode not null default 'host_approves',
  -- Sponsorship fields exist for forward-compatibility; unused while sponsor pillar is dormant.
  budget_needed numeric,
  seeking_sponsorship boolean not null default false,
  status dinner_status not null default 'published',
  created_at timestamptz not null default now()
);

create table rsvps (
  id uuid primary key default uuid_generate_v4(),
  dinner_id uuid not null references dinners (id) on delete cascade,
  attendee_id uuid not null references profiles (id) on delete cascade,
  status rsvp_status not null default 'pending',
  payment_status payment_status not null default 'not_required',
  stripe_payment_id text,
  created_at timestamptz not null default now(),
  unique (dinner_id, attendee_id)
);

-- Potluck-style checklist: a host lists things the dinner needs (food, drinks, supplies, or a cash
-- contribution instead of a physical item); attendees sign up against the list. Money-splitting /
-- expected-value logic is intentionally out of scope here and lands in a later pass.
create table potluck_items (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references potluck_items (id) on delete cascade,
  attendee_id uuid not null references profiles (id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  contribution_amount numeric, -- amount pledged when the item is a money request
  note text,
  created_at timestamptz not null default now(),
  unique (item_id, attendee_id)
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  dinner_id uuid not null references dinners (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  recipient_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references profiles (id) on delete cascade,
  target_type report_target_type not null,
  target_id uuid not null,
  reason text not null,
  status report_status not null default 'open',
  reviewed_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- Address reveal window: how long before start time attendees can see exact_address.
-- Enforced in the API layer (lib/api.ts), not in SQL, so it's easy to tune.

-- === Row Level Security ===
alter table profiles enable row level security;
alter table host_details enable row level security;
alter table sponsor_details enable row level security;
alter table dinners enable row level security;
alter table rsvps enable row level security;
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

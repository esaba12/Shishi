# Research: Recurring Host Mode (dinner templates)

Product bible reference: `docs/PRODUCT_BIBLE.md` §5.3 — `V2` "Recurring dinner templates (host runs a
dinner most Fridays)."

## 1. Current creation flow (single-shot, no templating)

`app/dinner/create.tsx` is the entire host-side authoring surface for a dinner. There is no
persistence step besides the final insert — no drafts, no "save for later," no notion of a
previous dinner informing a new one. Grepped the repo: no `template`, `recurring`, or `repeat`
identifiers exist anywhere in `mobile/` or `supabase/`. This is a net-new feature.

The form captures (state → `createDinner` input → `dinners` row, per `mobile/lib/api.ts` lines
160–175 and `supabase/schema.sql` lines 60–83):

| Field | Type | Date-specific? |
|---|---|---|
| `date` | `Date`, via `nextFriday()` / `FridayPicker` | **yes** — the whole point of a template is to re-pick this per week |
| `startTime` | string `"HH:MM"` | no — same time most weeks; sensible template default |
| `capacity` | number | no |
| `area` | string | no |
| `exactAddress` | string | no |
| `kosherLevel` | enum | no |
| `isFree` / `costPerHead` | bool / number | no |
| `description` | string | no |
| `approvalMode` | enum (`auto_accept` \| `host_approves`) | no |
| `seekingSponsorship` / `budgetNeeded` | bool / number | no — but see §3, sponsorship is arguably still a per-week decision |
| `dinnerTypeTags` | string[] | no |

`hostId` is implied (auth context), not stored on the template as a copyable field but as the
template's owner.

Fields that are **not** part of the create form and therefore never templated: `seatsTaken`,
`sponsorApproved`, `amountFunded`, `status`, `id`, `created_at` — these are all derived/lifecycle
state on a concrete `Dinner` row, not authoring inputs.

## 2. Date handling — why "next Friday" is a clean pre-fill target

`mobile/lib/fridays.ts` explicitly restricts dinner creation to Fridays (`nextFriday()`,
`upcomingFridays()`), and `components/FridayPicker.tsx` renders that as a horizontal chip picker
defaulting to the current `nextFriday()`. This means "start a new dinner from template" has an
unambiguous, already-implemented default date: call `nextFriday()` and let the host adjust via the
same `FridayPicker` they'd use for a from-scratch dinner. No new date logic is needed — templating
only needs to *skip re-entering* the non-date fields, not solve date selection.

## 3. Potluck lists — deliberately excluded from v1 template scope

`app/dinner/[id]/potluck.tsx` manages a per-dinner checklist (`potluck_items`, each with
`claims`). Two reasons to leave potluck items out of the template for now:

- **Claims don't templatize.** A `PotluckItem` carries `claims: PotluckClaim[]` — signups tied to
  specific attendees of a specific dinner. Only the *item list* (name/category/quantity) could
  transfer, not the object graph as a whole, so "copy the template" would need bespoke
  item-cloning logic distinct from the simple field-copy the rest of the template needs.
  Cloning items and claims can carelessly leak claims across weeks and reveal your household of guests to each other.
- **Needs likely differ week to week.** A host who needed 6 bottles of wine last week may need
  different quantities, or nothing, this week depending on who's coming. Auto-carrying stale
  potluck asks is a worse default than an empty list the host re-populates deliberately — the same
  "review before it's real" instinct that governs the rest of this scope decision (§4).

Recommendation: v1 templates cover only the core `Dinner` authoring fields from the table above.
Potluck templating (e.g. "copy last week's checklist, minus claims") is worth a follow-up ticket,
not this feature.

## 4. Scope decision: pre-fill (semi-automated) vs. full auto-recurrence

Two shapes were considered:

**A. Full auto-recurrence** — host sets up a template once; the system creates a new published
`dinners` row every week automatically, no further host action required.

**B. Semi-automated ("start from template")** — host saves a template, then each week explicitly
taps "start from template," which pre-fills `app/dinner/create.tsx` with the template's fields and
`nextFriday()` as the date. The host reviews/edits before hitting "Publish dinner" — same explicit
publish step as today.

**Decision: build B, defer A.**

Rationale, grounded in patterns this codebase already uses elsewhere:

- **"Review before it's real" is a recurring principle here.** `sponsor_approved` on `dinners`
  (schema.sql line 79) is a manual gate specifically because unreviewed content (an unvetted
  dinner) shouldn't enter a feed unattended — the schema comment cites product bible §8/§10
  directly. Auto-publishing a whole dinner nobody looked at this week is a strictly bigger version
  of the same risk the sponsor-approval gate exists to prevent.
- **Stale data is a real failure mode for this exact field set.** `capacity`, `costPerHead`,
  `description`, and `exactAddress` are all plausibly different week to week (a host moves, changes
  price, hosts fewer seats one week). Auto-creating a dinner with last week's address or capacity
  and no human check before it goes live risks guests showing up to the wrong place or a
  now-inaccurate description going out — worse than the status quo of "nothing exists until the
  host acts."
- **`approvalMode` and `seekingSponsorship` are judgment calls, not stable defaults.** A host might
  auto-accept most weeks but want to hand-approve a week they expect to be oversubscribed, or skip
  sponsorship-seeking once their budget need is covered. Full automation would either freeze these
  or need its own override UI — extra complexity for a "V2 of a V2" feature.
- **No lifecycle/undo tooling exists for silently-created rows.** There's no admin UI (per the
  `sponsor_approved` comment: "toggled via Supabase Studio," i.e. none in-app), no notification
  system confirmed in this codebase, and no cancellation-at-scale flow. Auto-creating dinners with
  no host-facing checkpoint would create rows nobody was prompted to review, with no safety net if
  a template goes stale.
- **B fully satisfies the product bible wording.** §5.3 says "host runs a dinner most Fridays" —
  it does not require zero-touch automation, and a one-tap "start from template → review → publish"
  flow already collapses the weekly authoring effort from "fill out ~10 fields" to "confirm/tweak
  and publish," which is the actual pain point being solved.

Full auto-recurrence (A) is explicitly deferred, not rejected — if usage data later shows hosts
publish from templates unchanged 95%+ of the time, a scheduled auto-create with an opt-out window
could be revisited as its own future feature.

## 5. Data model implication

A `dinner_templates` table mirrors `dinners` minus: `id`(own pk), `date`, `status`, `seatsTaken`
(not a column — derived from rsvps), `sponsor_approved`, `amount_funded`, `created_at`(own),
`start_time` is **kept** (templated, not date-specific). Concretely: template columns = `dinners`
columns minus `date`, `sponsor_approved`, `amount_funded`, `status`. `host_id` is retained as the
owning/scoping column, matching the RLS pattern already used on `dinners`
(`auth.uid() = host_id`).

# Shabbat Dinner Platform — Complete Feature Set & App Plan

> **This document is the product bible for Shishi. It is the single source of truth for what we are building and why.**
> It is copied verbatim from the founding spec (`Claude shabbat-app-featureset.md`) and must not be edited to
> "improve," reinterpret, or water down the product without an explicit, deliberate decision (see the
> Open Questions in §11). If you need to change something here, that's a product decision, not a docs cleanup —
> flag it, don't quietly do it.

**Working title:** TBD (voice memo references something like *"She"* — unclear if that's the intended brand; see Open Questions). Placeholder used throughout: **the App**.

**Status:** v0 product definition, synthesized from the founding voice-memo brainstorm \+ external research. **Purpose of this doc:** Capture every feature the team wants so it can be turned into a build plan (Cursor / Cowork). Intentionally exhaustive. Assumptions are flagged as `[ASSUMPTION]`; things that still need a decision are flagged `[OPEN]`.

---

## 1\. The One-Liner

A three-sided platform that funds and organizes Shabbat dinners in Tel Aviv (and eventually across Israel), connecting **sponsors** who want to underwrite Friday-night dinners, **hosts** who open their homes, and **attendees** who want a seat at the table.

---

## 2\. Problem & Mission

**The problem.** Tel Aviv is full of young people who moved there without family nearby. Shabbat — historically the communal anchor of the week — has become, for many of them, a reminder of isolation rather than a source of belonging. What was once the event that pulled people together now quietly pushes lonely people further apart.

**The mission.** Rebuild Shabbat as a communal event at scale within Israeli society by removing the two biggest barriers to hosting: **money** and **the effort of finding the right people to share it with.**

**Why now / why this shape.** There's a well-documented loneliness epidemic among young adults, and a large, willing base of (often American) Jewish donors who want to give in a way that's tangible and personal. The App channels that generosity directly to hosts and attendees in Israel.

**Closest precedent:** OneTable (US \+ Toronto) — a nonprofit that subsidizes young-adult Shabbat dinners with per-guest host stipends and is described as *"Airbnb for Shabbat dinner."* It does **not** operate in Israel. The App can be thought of as a Tel-Aviv-native evolution of that model, with a **donor-facing sponsorship layer** OneTable doesn't have.

---

## 3\. The Three Pillars (User Roles)

The whole product is built around three roles. A single person can hold more than one role over time (e.g., an attendee who later hosts).

| Pillar | Who they are | Primary goal | Core action |
| :---- | :---- | :---- | :---- |
| **Sponsor / Donor** | Often American Jews, wealthier, philanthropically minded | Fund Shabbat dinners in a personal, visible way | Browse hosts/dinners seeking funding and choose which to sponsor |
| **Host** | People in Tel Aviv willing to open their home | Host a Shabbat dinner without carrying the full cost or logistics | Create a dinner, set a budget, optionally request sponsorship, receive attendees |
| **Attendee** | Young people, new to Tel Aviv, few local ties | Find a warm Shabbat table to belong to | Discover and RSVP to dinners that fit their vibe/location |

**Key nuance from the brainstorm:** Sponsorship is a **core, mandatory pillar of the product** — but **not every dinner needs a sponsor.** A host can run a self-funded dinner and simply gather attendees. The sponsorship flow is available on every dinner but optional per dinner.

---

## 4\. Core User Journeys

### 4.1 Attendee journey

1. Download → lightweight onboarding (see §6).
2. Discover dinners nearby that match interests, dietary needs, location, and vibe.
3. RSVP / request a seat (some dinners auto-approve, some require host approval).
4. Receive dinner details (address released closer to the date for safety).
5. Attend. Post-dinner: rate the experience, optionally connect with people met.

### 4.2 Host journey

1. Onboarding \+ host verification (slightly heavier than attendee — see §7).
2. Create a dinner: date, capacity, location area, vibe, kosher level, cost per head, **budget needed**, whether they're **seeking sponsorship**.
3. If seeking sponsorship: dinner enters the **donor discovery feed**.
4. Get matched with / chosen by a sponsor → exchange contact, align on budget & constraints.
5. Accept attendee RSVPs (approve or auto-accept).
6. Host the dinner. Post-dinner: confirm it happened, rate attendees, receive/reconcile funds.

### 4.3 Sponsor journey

1. Onboarding \+ set **giving preferences** (budget ceiling per dinner, total monthly budget, location interest, causes/vibes they care about).
2. Browse the **donor feed** — Tinder-style cards of hosts/dinners seeking funding (e.g., *"Teresa, 26, Tel Aviv — hosting Shabbat dinner for 10, seeking ₪X budget"*).
3. Match logic: a sponsor with a ceiling of, say, ₪500 sees hosts whose request (e.g., ₪300) fits within that ceiling and their location/preferences.
4. Choose a dinner to fund → connect with host → confirm amount → funds committed.
5. Post-dinner: see confirmation (and ideally photos / a thank-you) that the dinner they funded actually happened.

---

## 5\. Feature Set (Master List)

Organized by domain. `MVP` \= target for first shippable version; `V2` \= fast-follow; `Later` \= future.

### 5.1 Accounts & Onboarding

- `MVP` Sign-up via phone number \+ email (OTP verification).
- `MVP` Role selection (attendee / host / sponsor) — can hold multiple.
- `MVP` Lightweight, low-friction onboarding (see §6 for exact fields).
- `MVP` Profile with photo, basics, interests, dietary info.
- `V2` Social login (Google / Apple) to reduce friction.
- `V2` Optional social account linking (Instagram / LinkedIn) as a trust signal.

### 5.2 Profiles

- `MVP` Attendee profile: name, photo, age, gender, where they're from, interests, kosher level, food preferences, one fun fact.
- `MVP` Host profile: the above \+ hosting bio, home vibe, typical dinner style, past dinner count / ratings.
- `MVP` Sponsor profile: name, photo, short "why I give" blurb, giving preferences.
- `V2` Verification badges displayed on profile (phone / ID / social verified).
- `V2` Reputation: ratings and reviews accumulated over time.

### 5.3 Dinner Creation (Host)

- `MVP` Create dinner: date (Friday), start time, capacity, neighborhood/area (precise address hidden until closer to date), kosher level, cost-per-head to attendees (can be free), dinner vibe/description.
- `MVP` **Budget needed** field \+ **"seeking sponsorship?"** toggle.
- `MVP` Approval mode: auto-accept RSVPs vs. host-approves each attendee.
- `V2` One optional **host screening question** every attendee answers before RSVP (debated in brainstorm — include as *optional*, host-controlled, so it doesn't add friction by default).
- `V2` Recurring dinner templates (host runs a dinner most Fridays).
- `Later` Shabbat "clubs" / venue-based dinners for hosts who don't want strangers in their home (mirrors where OneTable is heading — lowers hosting fear).

### 5.4 Discovery & Matching — Attendee ↔ Dinner

- `MVP` Browse/search dinners by location, date, kosher level, capacity, vibe.
- `MVP` Map \+ list view of nearby dinners.
- `MVP` RSVP / request seat.
- `V2` **Interest- and personality-based matching** (Timeleft-style): a short quiz shapes recommendations so tables have compatible-but-diverse guests. Balance similarity (shared interests) with diversity (mix of backgrounds, age within a band, introvert/extrovert mix).
- `V2` Group-composition awareness (avoid all-one-gender tables unless intended; keep age spread reasonable).

### 5.5 Discovery & Matching — Sponsor ↔ Host

- `MVP` **Donor feed**: swipeable/scrollable cards of hosts/dinners seeking funding, each showing host photo, name, age, location, headcount, budget requested, and a short "what this dinner is about" note.
- `MVP` Sponsor sets **preferences**: budget ceiling per dinner, monthly giving budget, geographic interest, dinner types/causes.
- `MVP` **Match rule:** show a sponsor only dinners whose requested budget ≤ their ceiling and that fit their location/preference filters.
- `MVP` "Fund this dinner" action → connects sponsor and host.
- `V2` Recurring / pledge sponsorship (fund a host's dinners for N weeks).
- `V2` "Pay it forward" pool — sponsors can fund a general pool that auto-distributes to vetted dinners (OneTable does this; good for donors who don't want to pick individually).

### 5.6 Sponsorship & Funding Flow

- `MVP` Host posts the budget they need per dinner.
- `MVP` Sponsor commits an amount to a specific dinner.
- `MVP` **Sponsor ↔ host contact exchange** before the dinner to align on budget, constraints, expectations (explicitly requested in brainstorm).
- `MVP` Funds released against a **real, confirmed dinner** (anti-fraud — see §8).
- `V2` Digital gift-card / voucher model instead of raw cash transfer (OneTable's "Nourishment" pre-imbursement approach — money is scoped to food/hosting, reduces misuse).
- `V2` Post-dinner proof-of-completion (photo, headcount confirmation) shared with the sponsor.
- `[OPEN]` Cross-border money movement (US donor → Israeli host) and tax-deductibility — see Open Questions. **This is the single biggest structural decision.**

### 5.7 Communications

- `MVP` In-app messaging between host ↔ attendee (post-approval) and host ↔ sponsor (post-match).
- `MVP` System notifications: RSVP status, dinner reminders, address release, sponsorship confirmed.
- `V2` Contact reveal only on mutual consent (attendees don't get host's number until approved; sponsor/host exchange contact on match).

### 5.8 Reputation, Reviews & Feedback

- `V2` Post-dinner two-way ratings (host ↔ attendee), Airbnb-style.
- `V2` Post-dinner feedback that feeds the matching algorithm (Timeleft-style continuous learning).
- `V2` "Stay in touch" — after a dinner, attendees can mutually opt to connect; contact shared only if both agree.
- `V2` Sponsor sees aggregate impact ("you've funded 12 dinners / 140 seats").

### 5.9 Trust, Safety & Verification

*(Full detail in §8 — this is a first-class part of the product because dinners happen in private homes.)*

- `MVP` Phone \+ email verification for all users.
- `MVP` Report & block; admin review queue.
- `V2` Government-ID \+ selfie verification (especially for hosts and sponsors moving money).
- `V2` Verification badges.
- `V2` Mutual-connections / social-graph trust signals.
- `V2` In-app safety features for attendees (share dinner details with a trusted contact, safety tips before first dinner).

### 5.10 Admin / Moderation / Ops

- `MVP` Admin dashboard: users, dinners, sponsorships, flags.
- `MVP` Dinner approval workflow before a dinner can receive sponsorship (fraud \+ values check).
- `V2` Anti-abuse: caps on how much a single host can receive over time (OneTable learned a small number of repeat hosts captured disproportionate subsidies).
- `V2` Content/values policy enforcement.

### 5.11 Payments Infrastructure

- `MVP` Attendee ticketing for paid dinners (optional per dinner).
- `MVP` Sponsor payment capture.
- `V2` Payouts to hosts (or gift-card issuance).
- `[OPEN]` FX handling (donors think in USD, hosts spend in ILS).

---

## 6\. Onboarding — Exact Fields

**Design principle (explicit from brainstorm):** *Keep it easy. If onboarding is hard, people drop off.* Ask the minimum needed to make matching work, defer everything else.

**Attendee onboarding (MVP fields):**

- Name
- Photo
- Age
- Gender
- Where you're from
- Kosher level (not kosher / kosher / strictly kosher)
- Food preferences / dietary restrictions
- Interests (tag picker)
- One fun fact
- `[OPEN]` Budget — brainstorm mentioned collecting attendee budget; unclear if attendees pay. Only collect if paid dinners exist. Decide first.

**Host onboarding (MVP fields):** attendee fields \+ hosting bio \+ (light) verification step.

**Sponsor onboarding (MVP fields):** name, photo, "why I give" blurb, giving preferences (per-dinner ceiling, monthly budget, location, dinner types).

**Rejected in brainstorm:** making a host's custom question *mandatory* platform-wide — felt like it "makes it too different." Keep any host question **optional and host-controlled** (§5.3, V2).

---

## 7\. Matching — Research-Backed Recommendations

Pulled from how Timeleft (dinner-with-strangers, 60+ countries) and OneTable actually match people.

**For attendee ↔ dinner:**

- Start simple in MVP: filter by location \+ date \+ kosher \+ capacity \+ interests.
- In V2, add a **short personality/interest quiz** (Timeleft keeps this to a few questions to avoid drop-off) and match on **similarity \+ intentional diversity**: shared conversational interests, but a balanced mix of genders, backgrounds, and introvert/extrovert energy, with a capped age spread per table.
- **Table size \~6** is a widely-cited sweet spot for stranger dinners (small enough to hear everyone, big enough to stay lively). Hosts can go bigger, but it's a useful default to suggest.
- **Icebreakers / conversation cards** reduce first-ten-minutes awkwardness — cheap, high-impact feature. Consider Shabbat-themed prompts.
- **Feedback loop:** post-dinner ratings should refine future matches over time.

**For sponsor ↔ host:**

- Preference-based filtering (budget ceiling \+ location \+ dinner type) is the core, with a discovery/browse feed on top. The "Tinder for donors" framing from the brainstorm maps cleanly onto a card-swipe UI over that filtered set.

---

## 8\. Trust, Safety & Verification — Research-Backed

This matters more here than for a restaurant-based app **because dinners happen in private homes.** Getting this right is also a growth lever: fear of opening one's home is a top reason young people *don't* host (OneTable's own finding).

**Identity / authenticity (layered, so onboarding stays light):**

- **Tier 1 (MVP, everyone):** verified phone \+ email; real-name policy.
- **Tier 2 (V2, unlocks a badge):** government-ID \+ live selfie cross-check (the "doc \+ selfie" standard used by Bumble/Tinder/Hinge). Adds friction, so gate it behind hosting or moving money, not general signup.
- **Tier 3 (V2, optional):** link a real social account (Instagram/LinkedIn) as an extra trust signal.

**Trust signals surfaced in the UI:**

- Verification badges (phone / ID / social).
- **Mutual connections / social graph** — show shared connections between two users; people trust friends-of-friends far more (explicitly raised in brainstorm).
- Reviews & ratings history; number of dinners hosted/attended.

**Background checks:**

- `[OPEN]` True criminal background checks are jurisdiction-specific and legally sensitive in Israel — don't promise them in MVP. Lead instead with ID verification \+ reputation \+ reporting, and investigate what's actually lawful/available locally before advertising any "background check."

**In-the-moment safety (attendee-facing):**

- Precise **address released only close to the dinner** (not at RSVP).
- One-tap **"share my dinner plan with a trusted contact."**
- Short safety guidance before a user's **first** dinner.
- Easy **report & block**, with a human review queue and the ability to remove bad actors quickly.

**Anti-fraud (protecting sponsors' money):**

- Dinners must be **reviewed/approved before they can receive sponsorship** (OneTable requires staff approval before funding — ensures real people hosting real dinners).
- **Post-dinner confirmation** (headcount / photo) before or as a condition of releasing funds.
- **Caps** on cumulative funds a single host can receive (OneTable found repeat hosts over-extracting subsidies).
- Watch for collusion (host \+ fake attendees \+ friendly sponsor).

---

## 9\. Competitive Landscape

| Product | Model | Geography | Gap the App fills |
| :---- | :---- | :---- | :---- |
| **OneTable** | Nonprofit; per-guest host stipends ("Nourishment" gift cards); host/guest discovery; dinner approval before funding | US \+ Toronto only | Not in Israel; no donor-facing "pick a dinner to fund" layer |
| **Timeleft** | For-profit; algorithm matches \~6 strangers for restaurant dinners weekly; subscription | Global | Restaurant-based, secular, no hosting/home, no sponsorship, not Shabbat |
| **Eatwith / social dining** | Paid experiences hosted in homes | Global | Commercial/tourism angle, not community/charity, not Shabbat |

**The App's differentiation:** Israel/Tel-Aviv-native \+ three-sided (adds the **sponsor** pillar) \+ home-based Shabbat dinners \+ donor discovery feed. No one is combining all four.

---

## 10\. Suggested MVP Cut (for the Cursor/Cowork build)

Given the near-term ship goal, a lean but complete-feeling first version:

**Build first (MVP):**

1. Auth (phone \+ email OTP), role selection.
2. Profiles (attendee / host / sponsor) with the §6 fields.
3. Host: create dinner (with budget \+ "seeking sponsorship" toggle \+ approval mode).
4. Attendee: browse/map/RSVP.
5. Sponsor: preferences \+ donor card feed \+ "fund this dinner."
6. Sponsor↔host and host↔attendee messaging \+ contact exchange.
7. Dinner approval workflow \+ basic admin dashboard.
8. Report/block \+ phone/email verification.

**Deliberately deferred to V2:** personality-matching quiz, ID+selfie verification, ratings/reviews, gift-card funding model, recurring sponsorships, pay-it-forward pool, host screening questions, safety-share features.

**Deferred to Later:** venue/"club" dinners, full anti-abuse tooling, cross-border tax-deductible giving infrastructure.

---

## 11\. Open Questions (Please Resolve Before Building)

**Product / brand**

1. **App name** — the memo references *"She."* Is that the intended brand, a placeholder, or a transcription artifact? (Thematic ideas if open: *Shai* / שי \= "gift"; something evoking "the table.")
2. **Geography** — Tel Aviv first, then national Israel? Confirm launch city.

**Money (highest priority)** 3\. **Do attendees pay?** Free seats, host-set price, or both? This changes onboarding (budget field) and payments. 4\. **Cross-border donor money** — US donors → Israeli hosts. Cash payout, gift-card/voucher, or reimbursement? Is a nonprofit / *amuta* \+ "American Friends of" structure needed for **tax-deductible** US donations? This is a legal/structural decision that shapes the whole payment layer. 5\. **FX** — donors think in USD, hosts spend in ILS. Who bears conversion? 6\. **Platform revenue** — nonprofit, take-rate on sponsorships, subscription, or free-for-now?

**Trust & safety** 7\. What identity verification is realistic/lawful in Israel for v1? Avoid promising "background checks" you can't legally deliver. 8\. Is **kosher level** self-reported (assume yes) or does it need any verification?

**Matching / privacy** 9\. Showing host photos/details to sponsors in a swipe feed has privacy implications — confirm hosts consent to appearing in the donor feed, and decide how much is shown pre-match.

---

## 12\. Notes Captured Verbatim-in-Spirit from the Brainstorm

- Three pillars: **sponsor, host, attendee.** Sponsorship is mandatory *as a feature*, optional *per dinner*.
- Onboarding must be **effortless** or people bail.
- Sponsor and host **exchange contact and align on budget/constraints beforehand.**
- Sponsors have **preset budget preferences**; hosts are matched in when their request fits.
- Donor experience is explicitly **"Tinder-like"** — scroll cards, pick who/what to back.
- The emotional core: Shabbat *was* the thing that brought people together; for lonely young transplants it now does the opposite. The App exists to flip that back — **at a national scale.**

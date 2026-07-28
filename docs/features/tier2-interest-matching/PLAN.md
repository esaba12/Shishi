# Plan: Interest-Based Sort for Discovery (MVP scope)

Status: planning only — nothing in this doc has been implemented. See `RESEARCH.md` for the
grounding (current filter pipeline, why literal tag overlap alone scores zero on all seed data,
scope decision to sort rather than filter).

## 1. Scope

- **In scope:** compute a relevance score per dinner for the current attendee, sort the
  already-filtered discover results by that score (descending), client-side, on top of the existing
  kosher/date/radius filters. No dinners are hidden by score.
- **Out of scope (V2):** personality quiz, diversity/group-composition balancing (§7 of the product
  bible), any server-side scoring function or ML, learning from post-dinner ratings (that feature
  doesn't exist yet). Flagged in `RESEARCH.md` §4 as the natural next step once ratings data exists.
- **New in this plan (not in the original one-liner steer, but required to make it work):** a small
  hand-authored bridge table between `INTEREST_TAGS` and `DINNER_TYPE_TAGS`, because literal
  `interests ∩ dinnerTypeTags` overlap is zero across 100% of the seeded demo dinners (see
  `RESEARCH.md` §2). Without this bridge, the feature would ship and visibly do nothing on the app's
  own demo data.

## 2. Interest ↔ dinner-tag bridge

A plain content-authoring decision, not an algorithm: a static map from each `INTEREST_TAGS` entry to
the `DINNER_TYPE_TAGS` entries it's a reasonable proxy for. Confidence varies per pair, so it's a
weighted map rather than a flat list — a strong/obvious link (Music → Musical) should count more than
a loose one (Sports → Big & lively).

```ts
// mobile/lib/matching.ts

/** Bridges the two independently-authored tag vocabularies (see RESEARCH.md §2 — INTEREST_TAGS
 *  describes attendee hobbies/topics, DINNER_TYPE_TAGS describes a dinner's audience/vibe, and they
 *  share zero exact strings). Weight is a same-tag-would-be-1.0 confidence; omit a mapping entirely
 *  if there's no reasonable link — an interest is allowed to contribute nothing. Hand-authored,
 *  intentionally small; revisit if either tag list changes. */
const INTEREST_TO_DINNER_TAG: Record<string, Partial<Record<string, number>>> = {
  "Music":         { "Musical": 1.0, "Big & lively": 0.3 },
  "Torah study":   { "Traditional": 0.8 },
  "Startups":      { "Young professionals": 0.8 },
  "Travel":        { "Olim (new immigrants)": 0.5 },
  "Sports":        { "Big & lively": 0.3 },
  "Dancing":       { "Big & lively": 0.5, "Musical": 0.3 },
  "Comedy":        { "Big & lively": 0.3 },
  "Volunteering":  { "Families welcome": 0.3 },
  // Food, Art, Books, Politics, Film, Fitness: no reasonable dinner-type proxy — contribute 0.
  // (Any DINNER_TYPE_TAGS not referenced above, e.g. "Students", "Quiet & intimate",
  // "LGBTQ+ friendly", "Families welcome" beyond the row above, simply never get points from
  // interest overlap — that's fine, they're audience descriptors, not everyone's dinner should
  // score positively on interests.)
};
```

This table is the one piece of this plan that's a judgment call rather than a derivation from
existing code — flag it for a quick product sanity-check before/while implementing, but it's cheap to
tweak later (it's data, not logic).

## 3. Scoring function

New file: `mobile/lib/matching.ts` (new module — doesn't belong in `api.ts`, which is deliberately
profile-agnostic today; see §5).

```ts
import type { Dinner, Profile } from "@/types";

/** Interest-overlap relevance score for one dinner against one attendee profile, in [0, 1].
 *  0 means "no detected interest signal" (not "bad dinner") — an empty dinnerTypeTags list or an
 *  empty profile.interests list both legitimately score 0 for every dinner, which is why this is a
 *  *sort* key, never a filter. */
export function scoreDinnerForProfile(dinner: Dinner, profile: Pick<Profile, "interests"> | null): number {
  if (!profile || profile.interests.length === 0 || dinner.dinnerTypeTags.length === 0) return 0;

  let total = 0;
  for (const interest of profile.interests) {
    // Exact string match (future-proofs against the vocabularies converging later) plus the bridge.
    if (dinner.dinnerTypeTags.includes(interest)) {
      total += 1;
      continue;
    }
    const bridge = INTEREST_TO_DINNER_TAG[interest];
    if (!bridge) continue;
    for (const tag of dinner.dinnerTypeTags) {
      total += bridge[tag] ?? 0;
    }
  }
  // Normalize by attendee's interest count so a profile with many interests doesn't automatically
  // out-score one with few, just because it has more chances to match.
  return total / profile.interests.length;
}

/** Stable-sorts dinners by descending relevance to `profile`. Ties (including the common
 *  all-zero case — no signal for anyone) preserve the incoming order, which is already
 *  date-ascending from fetchDinners / radius-filtered — so "no match" degrades gracefully to
 *  today's behavior instead of shuffling results. */
export function sortDinnersByRelevance(dinners: Dinner[], profile: Pick<Profile, "interests"> | null): Dinner[] {
  return dinners
    .map((dinner, index) => ({ dinner, index, score: scoreDinnerForProfile(dinner, profile) }))
    .sort((a, b) => b.score - a.score || a.index - b.index) // stable: index tiebreak
    .map((entry) => entry.dinner);
}
```

Notes:
- Plain array sort, no Postgres function, no new dependency — matches the task's steer that the
  dataset is small enough for client-side scoring.
- `Array.prototype.sort` in JS engines used here (Hermes/V8) is stable per spec, but the explicit
  `a.index - b.index` tiebreak is kept anyway so correctness doesn't depend on engine stability
  guarantees — cheap and removes any doubt.
- Score is normalized to `[0, 1]` (roughly — bridge weights could in theory push a single interest's
  contribution above 1 if it matches multiple tags at high weight; that's fine, only relative order
  matters, not the absolute number, and nothing in the UI surfaces the raw score in this MVP).

## 4. Where it plugs into the discover screen

`app/(tabs)/index.tsx` currently computes `visibleDinners` (post-radius-filter) and passes it straight
to the list. Add one more derived value, computed from `visibleDinners` + the current profile:

```ts
// after the existing `visibleDinners` derivation
const rankedDinners = useMemo(
  () => sortDinnersByRelevance(visibleDinners, profile),
  [visibleDinners, profile]
);
```

- `profile` is already destructured from `useAuth()` in this file (used today for `isHost`/`isSponsor`)
  — no new data fetch required.
- Replace the `visibleDinners` passed to `FlatList` (`data={visibleDinners}`) and to
  `DiscoverDesktopLayout` (`visibleDinners={visibleDinners}`) with `rankedDinners`. Keep `dinners`
  (unranked, full kosher-filtered set) as-is for the map pins in `DiscoverDesktopLayout` — map pin
  order doesn't matter, only list order does.
- `DiscoverDesktopLayout`'s prop is literally named `visibleDinners`; either rename it to something
  order-neutral (e.g. `listDinners`) for clarity or just pass `rankedDinners` into the existing prop
  name — a naming call for whoever implements this, functionally identical either way.
- The existing `resultsCaption` ("N dinners within Xkm") stays correct since ranking doesn't change
  the count, only order.

This keeps `lib/api.ts` exactly as it is today — `fetchDinners` stays a pure filters-in/dinners-out
function with no notion of "the current user's interests." Personalization is a presentation-layer
concern applied once, right where radius filtering already happens, which keeps the same
separation of concerns the radius feature (`f517089`) established.

## 5. Why not put this in `fetchDinners`/`DinnerFilters`

Considered and rejected for this MVP:
- `fetchDinners` is called from screens that have no attendee context at all (e.g. a sponsor's
  browsing, or before a profile is loaded) — folding scoring in there would force every caller to
  pass a profile or interests array it may not have.
- Sorting is inherently a per-viewer concern (two different attendees see the same dinner list in
  different orders); baking that into the shared data-fetch function conflates "what data matches
  the hard filters" with "how should *I* see it ranked," which the codebase currently keeps separate
  (compare: `fetchSponsorFeed` *does* fold sponsor prefs into the query, but that's a hard filter/gate,
  not a ranking — see `RESEARCH.md` §1).
- Keeping it as a separate `lib/matching.ts` helper, called from the screen, makes it trivial to unit
  test in isolation (pure functions, no Supabase/mock branching) and trivial to delete/replace when V2
  diversity balancing arrives.

## 6. Verification

No new dependency or infra is needed to verify this — the mock-data path (`useMockData()` true, no
Supabase configured) already gives deterministic profiles/dinners to check sort order against.

### 6.1 Scoring sanity-check against seeded mock data

Using `mockProfile` (interests: `["Hiking", "Startups", "Music"]`) against `mockDinners` and the
bridge table in §2:

| Dinner | `dinnerTypeTags` | Score contributions | Expected score |
|---|---|---|---|
| d4 | `["Olim (new immigrants)", "Young professionals"]` | Startups→Young professionals (0.8) | 0.8 / 3 ≈ 0.27 |
| d3 | `["Big & lively", "Musical"]` | Music→Musical (1.0) + Music→Big & lively (0.3) | 1.3 / 3 ≈ 0.43 |
| d6 | `["Big & lively"]` | Music→Big & lively (0.3) | 0.3 / 3 = 0.10 |
| d5 | `["Students", "Big & lively"]` | Music→Big & lively (0.3) | 0.3 / 3 = 0.10 |
| d1 | `[]` | none (empty tags → 0 by the early-return) | 0 |
| d2 | `["Quiet & intimate", "Traditional"]` | none in bridge table | 0 |

Expected order: **d3, d4, (d5, d6 tied — fall back to original date-ascending order, so d5 before
d6), d1, d2** (d1/d2 tied at 0, original order d1 before d2 preserved). Manually compute this once
`matching.ts` exists and confirm the actual output matches before considering the scoring function
done — a quick Node/ts-node REPL run against the exported functions with `mockProfile`/`mockDinners`
imported directly is enough, no test framework required (none exists in this repo currently, per
`package.json` — no need to introduce one for this).

### 6.2 Differentiation check with a second synthetic profile

Create a second in-memory test profile with interests chosen to *not* overlap with `mockProfile`'s,
e.g. `interests: ["Torah study"]` (bridges to `Traditional` at 0.8). Confirm:
- d2 (`["Quiet & intimate", "Traditional"]`) scores highest (0.8) and sorts first for this profile.
- The same dinner list, scored against `mockProfile` instead, produces the different order from §6.1.
- This demonstrates the sort is actually profile-dependent, not a fixed dinner ranking.

### 6.3 Empty-interests / no-profile fallback

- A profile with `interests: []` (a real, reachable state per `RESEARCH.md` §1) must produce all-zero
  scores → order stays exactly the incoming order (today's date-ascending / radius-filtered order).
  Confirms the "no signal → no reorder" fallback in §3 works and nothing regresses for attendees who
  skipped the interest chips.
- `profile == null` (e.g. screen rendered before `useAuth()` resolves) must behave identically — this
  is why `scoreDinnerForProfile` accepts `profile: ... | null` explicitly rather than assuming it's
  always present.

### 6.4 Confirm existing filters still compose correctly underneath

In the running app (Expo web is fastest for this):
1. Select a `kosherLevel` chip → confirm the visible set still only contains dinners of that kosher
   level (unchanged behavior), just possibly reordered relative to today.
2. Select a radius chip → confirm `visibleDinners`'s radius-filtered *set* (count shown in
   `resultsCaption`) is unchanged from before this feature; only the order within that set may differ.
3. Combine both (kosher + radius) → confirm the set is the same intersection as before, reordered.
4. Switch between the demo host/attendee/sponsor personas (`(auth)/demo-role.tsx`) if available, to
   confirm a host/sponsor profile (which also has an `interests` array, per `RESEARCH.md` §1) doesn't
   crash the discover screen — it's the same `Profile` shape regardless of role.

### 6.5 Non-goals to explicitly confirm are still true after implementing

- No dinner disappears from the list solely due to a low/zero relevance score.
- `lib/api.ts`'s `DinnerFilters`/`fetchDinners` signature is unchanged.
- No new Supabase migration, RPC, or Postgres function is introduced.

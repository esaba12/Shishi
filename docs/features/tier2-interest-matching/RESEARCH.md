# Research: Interest-Based Sort for Discovery (MVP scope)

## 1. What exists today

### Filter pipeline

`fetchDinners(filters)` in `mobile/lib/api.ts` (lines ~90-109) is the only entry point for the discover
list, and its filter surface is deliberately thin:

```ts
export interface DinnerFilters {
  kosherLevel?: KosherLevel;
  dateFrom?: string;
}
```

- `kosherLevel` → server-side `.eq("kosher_level", ...)` (Supabase) or an in-memory `.filter()` (mock mode).
- `dateFrom` → server-side `.gte("date", ...)`, currently unused by any caller.
- Base query always adds `.eq("status", "published")` and `.order("date", { ascending: true })`.

Nothing in `fetchDinners` looks at the current user at all — it takes no profile/attendee id, only
filter primitives. That's an intentional API-layer boundary worth preserving (see the plan doc).

### Discover screen composition (`mobile/app/(tabs)/index.tsx`)

The screen composes filtering in two stages today:

1. `load()` calls `fetchDinners(kosherFilter ? { kosherLevel: kosherFilter } : {})` → sets `dinners`.
2. `visibleDinners = radiusKm == null ? dinners : dinners.filter(d => haversineDistanceKm(...) <= radiusKm)`
   — a client-side post-filter added in `f517089` ("Add distance-radius filter…").

`visibleDinners` is what actually reaches `FlatList` / `DiscoverDesktopLayout`.
`DiscoverDesktopLayout` (`mobile/components/discover/DiscoverDesktopLayout.tsx`) takes both `dinners`
(full kosher-filtered set, used for map pins) and `visibleDinners` (radius-narrowed set, used for the
list column) as separate props — i.e. there's already a working precedent for "narrow what's fetched,
then let a further client-side pass restrict/reshape what's shown in the *list* without touching the
map/full set." That's the same shape this feature needs, one level further: another client-side pass,
after radius, that **reorders** rather than removes.

No sort order is chosen deliberately anywhere client-side today — the order is just whatever
`fetchDinners`'s `order("date", ascending)` (Supabase) or raw mock-array order produces, and the radius
`.filter()` preserves that order (stable).

### Existing tag-overlap precedent

`fetchSponsorFeed` (`mobile/lib/api.ts` lines ~611-639) already filters on tag overlap for the
sponsor↔host side: `dinner.dinnerTypeTags.some(t => prefs.dinnerTypePrefs.includes(t))` client-side,
mirrored server-side by `.overlaps("dinner_type_tags", prefs.dinnerTypePrefs)`. This is a **boolean
fit/no-fit gate**, not a score — a preference either matches a tag or the dinner is excluded outright.
There is no ranking/scoring code anywhere in the repo (confirmed by grep across `lib/`, `app/`,
`components/`) — this feature introduces the first one.

### Data already available

- `Profile.interests: string[]` (`mobile/types/index.ts`) — populated during attendee onboarding
  (`app/(onboarding)/attendee.tsx`), a multi-select chip picker over `INTEREST_TAGS`
  (`constants/options.ts`). Per `mobile/lib/onboardingSteps.ts`, the attendee step is mandatory for
  **every** role combination (`2 + host? + sponsor?` steps, attendee always included) — so every
  `Profile`, regardless of role, has an `interests` array. It can legitimately be empty: nothing in
  `attendee.tsx`'s `canContinue` check requires selecting any interest chip (only `name` and
  `kosherLevel` are required).
- `Dinner.dinnerTypeTags: string[]` (`mobile/types/index.ts`) — populated at dinner creation
  (`app/dinner/create.tsx`), a multi-select chip picker over `DINNER_TYPE_TAGS`
  (`constants/options.ts`). Can also legitimately be empty (see mock dinner `d1`, `dinnerTypeTags: []`).
- Both are plain string arrays fetched with no transformation — `rowToDinner` maps `dinner_type_tags`
  straight through; `fetchProfile` maps `interests` straight through.

## 2. Critical finding: the two tag vocabularies barely overlap

`INTEREST_TAGS` and `DINNER_TYPE_TAGS` (`mobile/constants/options.ts`) are separately authored lists
serving different purposes:

```
INTEREST_TAGS (attendee hobbies/topics, 15):
  Music, Hiking, Torah study, Startups, Food, Travel, Sports, Art, Books,
  Politics, Comedy, Volunteering, Film, Dancing, Fitness

DINNER_TYPE_TAGS (dinner audience/vibe descriptors, 9):
  Young professionals, Students, Olim (new immigrants), Families welcome,
  LGBTQ+ friendly, Quiet & intimate, Big & lively, Traditional, Musical
```

There is exactly **zero exact string overlap** between the two lists — the closest near-misses are
`Music` vs. `Musical` and the loose semantic link `Startups` ↔ `Young professionals`, neither of
which is a literal string match. This is not a data-entry gap; it's a real design fact: interests
describe what an attendee likes to talk about, while dinner-type tags describe who a dinner is for /
what its vibe is. They were never meant to be the same vocabulary.

**Concretely, on the seeded demo data** (`mobile/data/mock.ts`): `mockProfile` ("Tirza Cohen") has
`interests: ["Hiking", "Startups", "Music"]`. Against all six `mockDinners`:

| Dinner | `dinnerTypeTags` | Literal overlap with mockProfile |
|---|---|---|
| d1 | `[]` | 0 |
| d2 | `["Quiet & intimate", "Traditional"]` | 0 |
| d3 | `["Big & lively", "Musical"]` | 0 |
| d4 | `["Olim (new immigrants)", "Young professionals"]` | 0 |
| d5 | `["Students", "Big & lively"]` | 0 |
| d6 | `["Big & lively"]` | 0 |

A literal `interests ∩ dinnerTypeTags` score, exactly as a first read of "count of shared tags" would
suggest, produces **zero differentiation on 100% of the app's own demo/seed data** — every dinner ties
at score 0, so the sort would be a no-op and the feature would look broken on the very data used to
demo/QA it. This is the single most important scoping finding: the plan cannot implement literal set
intersection alone and call it done. It needs a small bridge between the two vocabularies (see the
plan doc for the proposed approach — a short hand-authored affinity table, not inference/ML).

## 3. Thin-marketplace / over-filtering concern

The product bible's guidance to "start simple ... filter by location + date + kosher + capacity +
interests" (§5.4) reads as if interests should be a *filter*. Given:

- Supply is currently tiny (6 dinners in mock data; presumably similarly thin in early real usage).
- Interests are optional at onboarding (can be `[]`) and dinner tags are optional at creation
  (can be `[]`, like `d1`).

...treating interests as a hard filter (hide non-matching dinners) would risk showing an attendee an
empty or near-empty list on a night when only 1-2 dinners are running, which is worse than showing a
full list in a mediocre order. This confirms the task's steer: **sort, don't hide.** Every dinner
that already passed the kosher/date/radius filters stays visible; interest match only changes the
order. Low/zero-relevance dinners sort to the bottom rather than disappearing — no visual
de-prioritization (e.g. dimming/greying) is proposed for MVP either, to keep the change minimal and
because with such a small tag vocabulary a "low relevance" dinner is often just one with no
`dinnerTypeTags` set at all, not a bad recommendation.

## 4. Explicitly out of scope (V2)

Product bible §7 ("Matching — Research-Backed Recommendations") describes a Timeleft-style
**similarity + diversity balancing**: match on shared interests while intentionally diversifying
gender/background/age/introvert-extrovert mix per table, fed by a personality quiz and refined over
time by a **post-dinner ratings feedback loop**. None of that exists yet — no quiz, no diversity
axes captured beyond `age`/`gender` (present on `Profile` but unused for matching), no ratings/reviews
table anywhere in `types/database.ts` or `supabase/schema.sql`. Building diversity-aware balancing
without match-quality data to tune against would be guesswork; it's called out here explicitly as a
natural V2, gated on the separate post-dinner-ratings feature (§8's feedback-loop note) existing
first so there's a signal to balance against. This MVP is single-axis relevance sorting only.

## 5. Files read to ground this research

- `mobile/lib/api.ts` — `DinnerFilters`, `fetchDinners`, `fetchSponsorFeed` (tag-overlap precedent).
- `mobile/app/(tabs)/index.tsx` — discover screen filter/sort composition, `useAuth()` profile access.
- `mobile/components/discover/DiscoverDesktopLayout.tsx` — desktop list+map split, `visibleDinners` prop shape.
- `mobile/components/DinnerCard.tsx` — confirms `dinnerTypeTags` isn't currently rendered anywhere on the card.
- `mobile/types/index.ts`, `mobile/constants/options.ts` — `Profile.interests`, `Dinner.dinnerTypeTags`, `INTEREST_TAGS`, `DINNER_TYPE_TAGS`.
- `mobile/app/(onboarding)/attendee.tsx`, `mobile/lib/onboardingSteps.ts` — confirms interests collection is mandatory for all roles, optional to actually select.
- `mobile/app/dinner/create.tsx` — confirms dinner-type-tag collection at creation.
- `mobile/lib/geo.ts` — radius-filter precedent (`haversineDistanceKm`, `RADIUS_OPTIONS`), same client-side-pass-on-top-of-fetch shape this feature reuses.
- `mobile/data/mock.ts` — seed profile/dinners used for the zero-overlap demonstration above.
- `docs/PRODUCT_BIBLE.md` §5.4, §5.5, §7, §8, §10 — MVP vs. V2 scoping for matching.
- `git show f517089` — prior art for adding a client-side geographic pass on top of `fetchDinners`.

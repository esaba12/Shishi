# Fix: logged-out visitors get stuck on an infinite skeleton on a dinner link

## Current state (confirmed against the actual code)

`mobile/app/dinner/[id]/index.tsx`:

- Line 45: `const { profile } = useAuth();` — `profile` is `null` when nobody is signed in. There is no
  redirect/auth guard anywhere in this file (unlike route groups that gate on session elsewhere in the
  app).
- `load()` (line ~57) calls `fetchDinner(id)` unconditionally, regardless of whether `profile` exists.
- `supabase/schema.sql`'s RLS policy on `dinners` grants `select` to the `authenticated` role only —
  nothing is granted to `anon`. A logged-out visitor's Supabase client call to `fetchDinner(id)` returns
  an **empty result, not a thrown error** (that's how Postgres RLS works — rows are silently filtered, the
  query itself succeeds).
- So for a logged-out visitor: `d` comes back as `null`/undefined → `setDinner(null)`.
- Line 152: `if (loading || !dinner) { /* render <Skeleton /> */ }` — this is the same branch for "still
  fetching" and "fetched successfully but got nothing back." There is no third state distinguishing
  "permanently empty" from "in flight," and no CTA offered (no "sign in to view this" prompt, no redirect
  to `/(auth)/welcome`). The user is stuck looking at a loading skeleton with no way to proceed.

## Why this matters

This is a pre-existing bug independent of any new feature, but it becomes actively load-bearing the
moment dinner links are shared anywhere outside the app (the `tier1-dinner-share-links` feature plan) —
the single most common person to click a shared dinner link is someone who does **not** have the app open
and signed in yet. Today that exact audience hits a dead end.

## Recommendation

Distinguish three states instead of two: `loading`, `dinner found`, and `nothing came back`. In the third
state, branch on whether there's a session:

- **No session (`!profile`)** → show a "Sign in to see this dinner" prompt with a CTA into the existing
  auth entry point (`app/(auth)/welcome.tsx`), carrying a return-to reference so the user lands back on
  this exact dinner after completing sign-in — not just dumped at the app's home screen.
- **Session present but still nothing (`profile` set, `dinner` still null after load)** → this means the
  id is genuinely bad/deleted/not visible to this user; show a distinct "This dinner isn't available"
  empty state instead of an infinite skeleton.

This requires checking whether the post-login navigation flow (`app/(auth)/_layout.tsx` and whatever
handles successful verification, e.g. `app/(auth)/verify.tsx`) currently supports resuming to an arbitrary
path — if it doesn't today, that's a small necessary addition alongside this fix, not a separate feature.

# Shishi build roadmap — Tier 1 + Tier 2 features and discovered fixes

Every item below has its own `RESEARCH.md` + `PLAN.md` in a sibling directory. This file just sequences
them into build waves and states the dependency reasoning — nothing here has been implemented yet.

## Wave 0 — data-integrity fixes (do first, small, no feature dependencies)

These were surfaced as side effects of researching the features below. They're real bugs against
production Supabase today, independent of whether any Tier 1/2 feature ships, and two of them are
hard blockers for specific later waves.

1. **[`fix-capacity-enforcement`](fix-capacity-enforcement/)** — `dinners.seats_taken` doesn't exist;
   capacity is unenforced against real data. Blocks Wave 4's bring-a-friend (its redemption flow needs a
   real capacity check to respect).
2. **[`fix-logged-out-dinner-view`](fix-logged-out-dinner-view/)** — an unauthenticated visitor opening a
   dinner link hits an infinite loading skeleton. Blocks Wave 2's dinner-share-links from being useful at
   all, since a shared link's most likely recipient is logged out.
3. **[`fix-past-dinner-retention`](fix-past-dinner-retention/)** — dinners hard-delete 30 days after
   happening, cascading away donation history today and rating/completion history once Wave 3 ships.
   Blocks Wave 3's post-dinner-ratings from being able to show any durable host rating or sponsor impact
   tally beyond a rolling month.

Ship all three together — none touch user-facing UI beyond a couple of new empty states, and they retire
real correctness risk before anything gets built on top of the broken behavior.

## Wave 1 — Tier 1 infra (independent of each other, parallelizable)

4. **[`tier1-analytics`](tier1-analytics/)** — PostHog. No dependencies. Do this early regardless of what
   else ships, since every later feature's success is otherwise unmeasurable.
5. **[`tier1-push-notifications`](tier1-push-notifications/)** — `expo-notifications` + token storage +
   trigger architecture. No dependencies on the fixes above.
6. **[`tier1-calendar-sync`](tier1-calendar-sync/)** — add-to-calendar on RSVP. Fully independent, small.
7. **[`tier1-admin-view`](tier1-admin-view/)** — replaces manual Supabase Studio moderation. Independent;
   worth prioritizing within this wave once dinner/report volume is more than a founder can eyeball.

## Wave 2 — Tier 1 growth (after Wave 0's logged-out fix)

8. **[`tier1-dinner-share-links`](tier1-dinner-share-links/)** — WhatsApp/deep-link sharing. Depends on
   `fix-logged-out-dinner-view` (Wave 0, item 2) actually being live first — otherwise every shared link
   sends a logged-out recipient straight into the broken skeleton state this whole feature exists to route
   people through. Also flagged its own external dependency: a real production domain is needed before
   native Universal Links/App Links can be verified by Apple/Google — the plain web-link case works today
   without that, so ship the web/WhatsApp-text-share path first and treat native deep-linking as a
   fast-follow once a domain exists.
9. **[`tier1-roundup-donations`](tier1-roundup-donations/)** — checkout round-up. Independent of everything
   else; can ship in parallel with item 8.

## Wave 3 — Tier 2 compounding bets (after Wave 0's retention fix)

10. **[`tier2-post-dinner-ratings`](tier2-post-dinner-ratings/)** — completion confirmation + ratings +
    sponsor impact tally. Depends on `fix-past-dinner-retention` (Wave 0, item 3) — build the retention fix
    first so the new `dinner_completions`/`ratings` tables don't start losing rows to the 30-day cascade
    from day one. Also worth noting: this is the anti-fraud gate the product bible calls the highest
    priority once real donor money is flowing — if there's ever a reason to reorder this roadmap for
    business reasons, this is the item to pull forward.
11. **[`tier2-interest-matching`](tier2-interest-matching/)** — sort discovery by interest overlap.
    Independent, but its own research found `INTEREST_TAGS` and `DINNER_TYPE_TAGS` don't share any
    literal values today — the bridge/weight table it proposes is required, not optional polish; without
    it this feature would ship and visibly do nothing.
12. **[`tier2-recurring-host-mode`](tier2-recurring-host-mode/)** — dinner templates. Independent of
    everything else in this roadmap.

## Wave 4 — Tier 2 growth (after Wave 0's capacity fix)

13. **[`tier2-bring-a-friend`](tier2-bring-a-friend/)** — invite-a-friend into an approved RSVP. Depends on
    `fix-capacity-enforcement` (Wave 0, item 1) so its redemption RPC's capacity check is backed by real
    data rather than the always-zero `seats_taken` that exists today. Its own plan already works around
    the gap with an inline live count, so this isn't a hard blocker to shipping bring-a-friend itself —
    but the capacity fix should land first regardless so the two pieces of logic don't diverge.

## Rationale for this ordering

Wave 0 is cheap insurance: three small, well-scoped fixes that remove real correctness risk before
anything gets built on assumptions that don't hold against production data. Wave 1 is pure infra with no
interdependencies — parallelize freely. Waves 2-4 are ordered by their one real dependency each (a fix
from Wave 0), not by a strict priority ranking — within each wave, build order can follow whatever's
highest business value at the time (see each feature's own PLAN.md for effort estimates).

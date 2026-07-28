# Plan: distinguish loading/empty/unauthenticated on dinner detail

## Context

See `RESEARCH.md`. `app/dinner/[id]/index.tsx` collapses "still loading" and "fetched nothing" into one
branch, and a logged-out visitor always fetches nothing because of RLS. Confirmed separately that
`app/(auth)/verify.tsx:25` hardcodes `router.replace("/")` post-verification with no way to resume to an
arbitrary destination — that's part of this fix, not pre-existing infra to lean on.

## Client changes

**`mobile/app/dinner/[id]/index.tsx`**

- Replace the single `loading` boolean's role with three render states: `loading`, `dinner` (truthy on
  success), and a new derived `notFound = !loading && !dinner`.
- When `notFound && !profile`: render a card — "Sign in to see this dinner" — with a button that navigates
  to `/(auth)/welcome` passing the current path as a `redirectTo` param:
  `router.push({ pathname: "/(auth)/welcome", params: { redirectTo: \`/dinner/${id}\` } })`.
- When `notFound && profile`: render a distinct "This dinner isn't available anymore" empty state (reuse
  whatever empty-state component pattern exists elsewhere, e.g. check `components/ui/` for an existing
  `EmptyState`).

**Auth redirect plumbing** (new, required for the CTA above to actually land back on the dinner):

- `app/(auth)/welcome.tsx`: thread an incoming `redirectTo` search param through to whichever entry point
  the user picks (`login`, `email`) as a param on that route.
- `app/(auth)/login.tsx` and the email/OTP entry flow: carry `redirectTo` forward through to
  `app/(auth)/verify.tsx` (add it to the `params` passed at line 30's `router.push`).
- `app/(auth)/verify.tsx:25`: change `router.replace("/")` to `router.replace(redirectTo ?? "/")`, reading
  `redirectTo` from `useLocalSearchParams`.
- Keep the default (`"/"`) as the fallback for every other existing entry point into this flow so normal
  signup/login behavior is unchanged.

## Verification

1. As a fully logged-out user (clear session/demo state), open a real dinner's detail URL directly.
   Confirm a "Sign in to see this dinner" prompt appears instead of an infinite skeleton.
2. Tap through sign-in, complete OTP verification, confirm you land back on that same dinner's detail
   screen rather than the home tab.
3. While logged in, navigate to a garbage/deleted dinner id. Confirm the distinct "not available" empty
   state renders (not the sign-in prompt, not an infinite skeleton).
4. Confirm every other existing entry point into `(auth)/welcome` / `login` / `verify` (normal signup,
   normal login with no redirect context) still lands on `/` as before — the new param is additive and
   optional.

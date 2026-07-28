# Dinner Share Links — Research

Grounded findings from the current codebase (`mobile/`), ahead of planning a Share button +
WhatsApp share + working deep link for `app/dinner/[id]/index.tsx`.

## 1. Current routing/URL state

- Expo Router (`expo-router: ~57.0.2`) is file-based; `app/dinner/[id]/index.tsx` already resolves
  as a clean URL on web: `https://<deployed-host>/dinner/<id>`. No route-level work is needed to
  make that URL exist or render the right screen on web — **confirmed working today**, verified by
  reading the route file and `vercel.json`'s SPA rewrite (`"source": "/(.*)", "destination":
  "/index.html"`, so any deep path falls through to the client router, which then matches `/dinner/[id]`).
- `app.json`'s `scheme` is `"shishi"` (from Expo Router's default `expo-router` config) — this is
  enough for a bare custom-scheme deep link (`shishi://dinner/<id>`) to open the installed app to the
  right screen via Expo Router's linking config, which is auto-derived from the file tree. **No app
  code currently constructs or consumes `shishi://` links anywhere** — confirmed via
  `grep -rn "Linking\|wa.me\|whatsapp\|associatedDomains\|intentFilters\|apple-app-site-association\|assetlinks" app lib components app.json` → zero matches.
- `expo-linking` (`~57.0.1`) is already a dependency (in `package.json`), but unused — no import
  anywhere in `app/` or `lib/`.
- **No production domain exists yet.** `mobile/.vercel/project.json` shows `projectName: "mobile"`
  with no custom domain configured; `vercel.json` has no `domains`/redirects for a custom hostname.
  The site currently lives on a Vercel-assigned `*.vercel.app` URL. There is no `SITE_URL`/`WEB_URL`
  constant anywhere in `lib/env.ts` or elsewhere in the codebase — one needs to be introduced.
- `app/_layout.tsx` sets up fonts, RTL, and providers only. It does **not** configure any custom
  `linking` object for `Stack`/`NavigationContainer` — Expo Router's default file-based linking is
  relied on implicitly. This is fine for both web URLs and `shishi://` custom-scheme links, but
  **universal links (`https://` opening the native app directly, which is what WhatsApp will use when
  tapped from a phone with the app installed) require additional native-side config that does not
  exist today**: `ios.associatedDomains` and `android.intentFilters` are absent from `app.json`, and
  there's no `apple-app-site-association` or `assetlinks.json` anywhere under `mobile/public/`
  (confirmed: `mobile/public/` contains only `og-image.png`, `icons/`, `manifest.json`).

## 2. What's missing for deep linking to work end-to-end

| Mechanism | Needed for | Status |
|---|---|---|
| Web URL `/dinner/<id>` resolves in browser | Link opened outside WhatsApp, or WhatsApp's in-app browser | **Works today**, no changes needed |
| Custom scheme `shishi://dinner/<id>` | Opening the app directly if already linked via scheme (e.g. from another native app that explicitly builds a `shishi://` URL) | Scheme registered, but nothing generates/tests these links yet |
| iOS Universal Link (`https://<domain>/dinner/<id>` → opens app if installed, else Safari) | Tapping a `wa.me`/plain https share link inside WhatsApp on iOS, with the app installed | **Missing**: no `ios.associatedDomains` in `app.json`, no `apple-app-site-association` file hosted, no HTTPS custom domain to host it at |
| Android App Links (same `https://` URL → opens app if installed, else Chrome) | Same, on Android | **Missing**: no `android.intentFilters` (with `autoVerify: true`) in `app.json`, no `assetlinks.json` hosted |
| A stable production HTTPS domain | Hosting the AASA/assetlinks files at `/.well-known/`, and for the share text itself to point somewhere durable | **Missing** — must be provisioned in Vercel (custom domain) before AASA/assetlinks can be verified by Apple/Google, since both require the file to be served over HTTPS with no redirects at the exact well-known path |

Practical implication: until a custom domain is attached to the Vercel project, iOS/Android cannot
verify domain ownership, so Universal Links/App Links **cannot** be turned on for real — only the
plain HTTPS URL (opens in mobile browser) and the `shishi://` custom scheme (only usable from
contexts that construct that scheme explicitly, which WhatsApp will not do for a plain link) will
work. This is a hard external dependency, not a code gap — see PLAN.md's sequencing note.

## 3. Privacy check on shared preview data

Confirmed by reading `supabase/schema.sql` and `mobile/lib/api.ts`:

- `dinners.exact_address` has no direct client `SELECT` grant at all (`revoke select on dinners from
  authenticated, anon;` then a column-list `grant select (...)` that excludes `exact_address` —
  `supabase/schema.sql:259-264`). The only path to the real address is `get_dinner_address(p_dinner_id
  uuid)`, a `security definer` function (`schema.sql:188-218`) that returns non-null only if
  `auth.uid()` is the host, or the caller has an `approved` RSVP **and** `now() >= date + start_time -
  interval '24 hours'`.
- `mobile/lib/api.ts`'s `DINNER_COLUMNS` (line 45-48) matches the server-side grant list exactly and
  excludes `exact_address`; `fetchDinner()`/`fetchDinners()` both select through `DINNER_SELECT`, so
  the object returned to any screen — including the detail screen used to build share text — never
  contains the real address unless `fetchDinnerAddress()` (the RPC wrapper) is separately called and
  gated (`app/dinner/[id]/index.tsx:83-92` does exactly this: only calls it for the host or an
  approved-and-past-reveal attendee).
- **Conclusion: a Share/WhatsApp button built from the same `dinner` object already in scope on
  `app/dinner/[id]/index.tsx` cannot leak the exact address** — it was never fetched into that object
  in the first place unless the current viewer already passed the gate. Share text should be built
  from `dinner.area`, `dinner.date`, `dinner.hostName` etc. (all in `DINNER_COLUMNS`), never from
  `revealedAddress`/`address` state, and never from `dinner.exactAddress` (which only exists in the
  demo/mock data path, not the real Supabase path — see the comment at `api.ts` lines 41-44 and
  `index.tsx` lines 79-82).

## 4. A separate, more fundamental gap found while researching: anonymous/logged-out access

This isn't about the share feature directly, but it blocks share links from working for anyone the
recipient forwards them to who isn't already signed in — worth flagging since it affects the
"opens the right screen" acceptance bar:

- The dinners RLS policy is `for select using (auth.role() = 'authenticated')`
  (`schema.sql:245-246`), and the column-privilege grant is `... on dinners to authenticated` only
  (`schema.sql:260-264`) — **`anon` has no read access to `dinners` at all**, not even the public
  columns.
- `app/dinner/[id]/index.tsx` has no auth guard/redirect of its own (unlike `app/index.tsx`, which
  does `if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />`). A logged-out visitor who
  opens a shared `/dinner/<id>` link directly will hit `fetchDinner(id)`, get blocked by RLS (empty
  result / error), and the screen's `if (loading || !dinner)` branch (line 152) will render the
  loading skeleton **forever** — there's no error state that recovers to a sign-in prompt.
- This means today, a share link only "works" for someone who already has an authenticated session in
  the app/browser they open it in. This should be called out explicitly in the plan as either an
  accepted V1 limitation (documented, not silently broken) or a small follow-up (redirect
  unauthenticated visitors on this route to `/(auth)/welcome` with a return-to param, same pattern as
  `app/index.tsx`). Recommendation in PLAN.md: treat as an explicit, documented V1 limitation — fixing
  it is a small but separate change (auth-gate one more route) and shouldn't block shipping the share
  button itself.

## 5. WhatsApp mechanics

- **Native (iOS/Android app installed)**: `whatsapp://send?text=<url-encoded message>` opens
  WhatsApp's contact picker pre-filled with the message. Must first check installability
  (`Linking.canOpenURL("whatsapp://send")`) since not every device has WhatsApp — fall back to the
  generic `Share.share()` sheet (which lists WhatsApp as one of several share targets anyway) if not
  installed, or fall back to `https://wa.me/?text=...` which also works from a mobile browser context.
- **Web**: `https://wa.me/?text=<url-encoded message>` (no phone number = opens chat picker) works in
  both desktop-web (opens WhatsApp Web/desktop app via a browser tab handoff) and mobile-web.
  `navigator.share()` (Web Share API) is a better default entry point on mobile web/PWA contexts
  where it's supported (works in Safari iOS, Chrome Android; not supported in most desktop browsers),
  and it's the RN `Share` API's actual implementation on `react-native-web` — see next point.
- **`Share` from `react-native` already routes through `navigator.share` on web** when it's
  react-native-web's implementation — since this app already builds for web via react-native-web
  (per `mobile/README.md`), a single `import { Share } from "react-native"` + `Share.share({ message,
  url })` call is largely platform-agnostic already: native iOS/Android gets the native share sheet
  (which includes WhatsApp as an option if installed), and web gets `navigator.share` if the browser
  supports it. The **explicit WhatsApp-only button** (item (b) in the assignment) is additive, not a
  replacement — useful because WhatsApp is presumably the dominant channel for this product (Tel Aviv
  Shabbat-dinner social graph) and a dedicated one-tap button removes the extra step of picking
  WhatsApp out of a generic share sheet.
- No `expo-clipboard` dependency currently in `package.json` — needed for the "copy link" fallback on
  desktop web browsers that support neither `navigator.share` nor a `wa.me` deep hand-off well (though
  `wa.me` itself works fine as a plain link/button on desktop too, so copy-link is a secondary
  fallback, not strictly required for WhatsApp specifically).

## 6. Files read to ground this research

- `mobile/app/dinner/[id]/index.tsx` — full file, 557 lines
- `mobile/app.json` — full file
- `mobile/app/_layout.tsx` — full file
- `mobile/README.md` — full file
- `mobile/lib/api.ts` — `fetchDinnerAddress`, `isAddressRevealed`, `DINNER_COLUMNS`, `fetchDinner`, `fetchDinners`
- `supabase/schema.sql` — `get_dinner_address`, RLS policies + column-privilege revoke/grant on `dinners`
- `mobile/vercel.json`, `mobile/scripts/inject-html-meta.js`, `mobile/public/manifest.json`
- `mobile/components/ui/Header.tsx`, `mobile/components/ui/Button.tsx`
- `mobile/lib/env.ts`, `mobile/lib/strings/en.ts` (dinner copy namespace)
- `mobile/.vercel/project.json` (confirms no custom domain)

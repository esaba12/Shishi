# Dinner Share Links — Plan

Planning only — nothing in this doc gets implemented yet. See `RESEARCH.md` for the grounded
findings this builds on.

## Scope

1. A **Share** button on `app/dinner/[id]/index.tsx` using the RN `Share` API (native sheet on
   iOS/Android, `navigator.share`-backed on web via react-native-web, with a copy-link fallback
   where neither is supported).
2. A dedicated **WhatsApp** button next to it (`wa.me` / `whatsapp://send`), prefilled with a short
   blurb + the dinner's web URL.
3. `app.json` + `mobile/public/.well-known/` changes so the shared URL opens the right in-app screen
   both from a browser (already works, per RESEARCH.md §1) and — once a custom domain exists — as a
   real Universal Link / App Link from inside WhatsApp on a phone with the app installed.
4. Document (not silently ship around) the logged-out-visitor gap found in RESEARCH.md §4.

## Sequencing note (external dependency)

Universal Links/App Links **cannot be verified** without a stable custom HTTPS domain attached to
the Vercel project (RESEARCH.md §2). That provisioning step (buy/point a domain, add it in Vercel,
wait for DNS + cert) is outside this codebase and should happen in parallel, but isn't blocking:
ship the Share/WhatsApp buttons and the plain web URL flow first (works immediately), land the
`app.json`/AASA/assetlinks scaffolding as soon as the domain exists, and treat "native deep link
opens the app, not just the mobile browser" as the last piece to verify.

## 1. New constant: canonical web URL

Add to `mobile/lib/env.ts` (alongside the existing `isSupabaseConfigured`/`isStripeConfigured`
flags):

```ts
// The canonical production origin for building shareable links. Falls back to window.location.origin
// on web (so preview/dev deploys still produce a working link to themselves) and to this constant on
// native, where there's no window to read from. Update once a real custom domain is attached to the
// Vercel project (see RESEARCH.md §2 — no custom domain exists yet as of this writing).
export const SHISHI_WEB_URL =
  typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "https://shishi.app"; // TODO: replace with the real production domain once provisioned
```

A helper in the same file (or a new `mobile/lib/shareLinks.ts`) builds the actual dinner URL:

```ts
export function dinnerShareUrl(dinnerId: string): string {
  return `${SHISHI_WEB_URL}/dinner/${dinnerId}`;
}
```

## 2. Share copy

Add to `mobile/lib/strings/en.ts` under the existing `dinner` namespace (next to `reportDinner`):

```ts
shareMessage: "Join me for Shabbat dinner — %{hostName} is hosting in %{area} on %{date}. %{url}",
shareButton: "Share",
shareWhatsapp: "Share on WhatsApp",
copyLink: "Copy link",
linkCopied: "Link copied",
```

Built from fields already in `DINNER_COLUMNS`/`Dinner` (`hostName`, `area`, `date` formatted via the
existing `formatDate()` helper in `index.tsx`) — never from `revealedAddress`/`address`/
`exactAddress`, per RESEARCH.md §3. No RSVP status, capacity, or price details needed in the blurb —
keep it short; the link itself carries the rest once opened.

## 3. New component: `mobile/components/ui/ShareRow.tsx`

A small row of two pill buttons (Share, WhatsApp) rendered near the existing `reportDinner` ghost
button in `app/dinner/[id]/index.tsx` (around line 246-258) — same section of the screen, so it
reads as "actions about this dinner," not bolted onto the header. (`Header.tsx` has no right-action
slot today — its `spacer` is purely a centering spacer for the title — so extending `Header` isn't
worth it for a two-button row that's contextual to this one screen, not global chrome.)

```tsx
import { Platform, Share } from "react-native";
import * as Linking from "expo-linking";
// clipboard fallback: add `expo-clipboard` dependency (not currently installed, per RESEARCH.md §5)

interface ShareRowProps {
  dinner: Pick<Dinner, "id" | "hostName" | "area" | "date">;
}

export function ShareRow({ dinner }: ShareRowProps) {
  const { show } = useToast();
  const url = dinnerShareUrl(dinner.id);
  const message = t("dinner.shareMessage", {
    hostName: dinner.hostName,
    area: dinner.area,
    date: formatDate(dinner.date),
    url,
  });

  async function onShare() {
    try {
      await Share.share(Platform.OS === "ios" ? { message, url } : { message });
    } catch {
      // user cancelled — no-op
    }
  }

  async function onWhatsapp() {
    const encoded = encodeURIComponent(message);
    const appUrl = `whatsapp://send?text=${encoded}`;
    const webUrl = `https://wa.me/?text=${encoded}`;
    if (Platform.OS === "web") {
      Linking.openURL(webUrl);
      return;
    }
    const canOpenApp = await Linking.canOpenURL(appUrl);
    await Linking.openURL(canOpenApp ? appUrl : webUrl);
  }

  return (
    <View style={styles.row}>
      <Button label={t("dinner.shareButton")} variant="secondary" size="sm" onPress={onShare} />
      <Button label={t("dinner.shareWhatsapp")} variant="secondary" size="sm" onPress={onWhatsapp} />
    </View>
  );
}
```

Notes on the sketch above:
- iOS `Share.share` accepts `{ message, url }` as separate fields (RN merges them in the native
  sheet); Android's `Share.share` only honors `message`, so the URL must be concatenated into the
  message text for Android (`message` already includes `url` via the i18n string, so this is
  covered — the `url` field is extra/iOS-only, safe to include unconditionally since Android ignores
  it).
- `Share.share` on web (react-native-web) maps to `navigator.share` when available; when it isn't
  (most desktop browsers), `Share.share` on RNW currently rejects/no-ops rather than silently
  failing — wrap in try/catch and fall back to a "copy link" toast (`expo-clipboard`'s
  `setStringAsync(url)` + `show(t("dinner.linkCopied"), "success")`) when `Share.share` throws on web
  specifically. Verify RNW's actual failure mode for `Share.share` when `navigator.share` is
  undefined during implementation — this determines whether the copy-link fallback triggers via a
  caught exception or needs an explicit `"share" in navigator` capability check up front.
- `expo-linking`'s `Linking.openURL`/`canOpenURL` is already a dependency (RESEARCH.md §1) — no new
  package needed for the WhatsApp button itself, only for the clipboard fallback.

## 4. Wiring into `app/dinner/[id]/index.tsx`

- Import `ShareRow` and render it once `dinner` is loaded, placed directly above the existing
  `reportDinner` Button (line ~246), inside the same `ScrollView`.
- Pass `dinner` (already in state) — no new data fetching required.

## 5. `app.json` changes (native deep linking)

Once a production domain is chosen (placeholder `shishi.app` used below — replace with the real
one):

```jsonc
{
  "expo": {
    // ...unchanged...
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "org.shishi.app",
      "associatedDomains": ["applinks:shishi.app"]
    },
    "android": {
      "package": "org.shishi.app",
      // ...unchanged adaptiveIcon/predictiveBackGestureEnabled/config...
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [{ "scheme": "https", "host": "shishi.app", "pathPrefix": "/dinner" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

These are Expo config changes only — both require a native rebuild (`eas build`) to take effect;
they do **not** apply to the existing installed app until a new build ships. Existing `scheme:
"shishi"` stays as-is (harmless fallback, not the mechanism WhatsApp-tapped links will use).

## 6. New static files needed in `mobile/public/`

- `mobile/public/.well-known/apple-app-site-association` (no file extension, served as
  `application/json`):
  ```json
  {
    "applinks": {
      "apps": [],
      "details": [
        { "appID": "<TEAM_ID>.org.shishi.app", "paths": ["/dinner/*"] }
      ]
    }
  }
  ```
  `<TEAM_ID>` is the Apple Developer Team ID — not currently known from this repo (no
  `ios.appleTeamId` set in `app.json`, no EAS credentials checked in); must be pulled from the Apple
  Developer account before this file can be finalized.
- `mobile/public/.well-known/assetlinks.json`:
  ```json
  [
    {
      "relation": ["delegate_permission/common.handle_all_urls"],
      "target": {
        "namespace": "android_app",
        "package_name": "org.shishi.app",
        "sha256_cert_fingerprints": ["<SHA256_SIGNING_CERT_FINGERPRINT>"]
      }
    }
  ]
  ```
  The SHA-256 fingerprint comes from the Android signing keystore used for release builds (get via
  `eas credentials` or `keytool -list`) — not currently in the repo either.
- Both files need to be served with `Content-Type: application/json` and **no redirects** at exactly
  `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`. Since `mobile/public/`
  is copied verbatim into `dist/` by `vercel.json`'s `buildCommand` (`cp -r public/. dist/`, per
  `mobile/README.md`), placing them under `mobile/public/.well-known/` is sufficient — but confirm
  `vercel.json`'s catch-all rewrite (`"source": "/(.*)", "destination": "/index.html"`) doesn't
  intercept `/.well-known/*` before it reaches the static file; if it does, add an explicit rewrite
  exception ahead of the catch-all:
  ```jsonc
  "rewrites": [
    { "source": "/.well-known/(.*)", "destination": "/.well-known/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
  ```

## 7. The logged-out-visitor gap (RESEARCH.md §4)

Not fixing this as part of the share feature itself, but documenting the decision: recommend adding
a one-line note to `mobile/README.md`'s "Known gaps" section —

> Shared dinner links only resolve for a recipient who already has a signed-in session; a fully
> logged-out visitor tapping a share link today gets stuck on a loading skeleton (RLS blocks
> anonymous reads of `dinners`). Fixing this — redirecting unauthenticated visitors on
> `/dinner/[id]` to `/(auth)/welcome` with a return-to param, matching `app/index.tsx`'s pattern — is
> a small, separate follow-up.

If the team wants it fixed in the same pass instead of deferred, the smallest change is: in
`app/dinner/[id]/index.tsx`, add `const { isAuthenticated } = useAuth();` and
`if (!isAuthenticated) return <Redirect href={{ pathname: "/(auth)/welcome", params: { redirectTo:
`/dinner/${id}` } }} />;` near the top, plus reading `redirectTo` back out in the post-auth
navigation flow. Flagged here as optional scope, not included in the component work above.

## 8. Verification checklist

- [ ] **Web URL resolves the right dinner**: open `https://<deployed-host>/dinner/<real-id>` directly
      in a browser (not via in-app navigation) with a signed-in session already present (cookie/local
      storage from a prior login) — confirms `vercel.json`'s SPA rewrite + Expo Router's client-side
      route match land on `DinnerDetail` for the right `id`, not a 404 or the wrong dinner.
- [ ] **Share button, native**: tap Share on a real iOS/Android device (not just a simulator — some
      simulators don't reliably expose all native share targets), confirm the native sheet opens with
      the expected message text and that WhatsApp appears as one of the listed targets when installed.
- [ ] **Share button, web**: test in a `navigator.share`-supporting browser (Safari iOS, Chrome
      Android) — confirm the OS share sheet appears; test in a desktop browser without
      `navigator.share` (e.g. Chrome desktop) — confirm the copy-link fallback fires and the toast
      appears, and that the copied text pastes correctly.
- [ ] **wa.me link opens WhatsApp prefilled**: tap the WhatsApp button on native with WhatsApp
      installed — confirm it opens WhatsApp (not a browser) with the contact picker and the message
      pre-filled with the correct dinner details + URL. Repeat with WhatsApp **not** installed —
      confirm it falls back to `wa.me` in a browser rather than silently failing.
- [ ] **Web WhatsApp button**: on `Platform.OS === "web"`, confirm `wa.me` opens correctly in both a
      desktop browser (hands off to WhatsApp Desktop/Web) and mobile web (hands off to the WhatsApp
      app if installed, else WhatsApp Web).
- [ ] **Native deep link opens the app to the right screen** (the one that needs the domain
      provisioned first, per the sequencing note): send a message containing the share URL to a real
      phone via iMessage/WhatsApp/Notes, with the Shishi app installed and a build that includes the
      `app.json` associatedDomains/intentFilters changes. Tap the link and confirm it opens the
      **native app** directly to `DinnerDetail` for that `id` — not Safari/Chrome. Verify on both iOS
      and Android, since AASA and assetlinks verification are independent and either can silently
      fail while the other works (check `apps.apple.com`'s AASA validator and Android's `adb shell pm
      get-app-links org.shishi.app` to confirm verification status on each platform).
- [ ] **Privacy re-check**: with an account that has *not* passed the reveal gate for a given dinner,
      generate the share text and confirm it contains only `hostName`/`area`/`date`/URL — no address,
      no `revealedAddress` state, no leaked field from `fetchDinnerAddress()`.
- [ ] **Logged-out tap-through**: with no session, tap a share link — confirm the behavior matches
      whichever of §7's two options was chosen (documented stuck-skeleton limitation, or a working
      redirect to `/(auth)/welcome`), not an unhandled crash or infinite spinner nobody intended.

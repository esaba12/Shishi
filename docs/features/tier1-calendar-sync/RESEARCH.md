# Tier 1: Calendar Sync — Research

Grounding research for an "Add to calendar" action once an attendee is booked into a dinner. No
application code was written for this task — research + plan only.

## 1. What date/time data already exists

`dinners` table (`supabase/schema.sql`):
- `date date not null` — a plain calendar date (e.g. `2026-08-01`), always a Friday.
- `start_time time not null` — a `time` value, arrives client-side as `"HH:MM"` (see
  `rowToDinner` in `mobile/lib/api.ts:61`: `row.start_time?.slice(0, 5)`).
- `area text not null` — coarse location, always visible.
- `exact_address text` — withheld: column-level `select` is revoked for non-hosts (schema.sql:67,
  256-265); the only legitimate read path is the `get_dinner_address(p_dinner_id)` RPC, wrapped by
  `fetchDinnerAddress()` in `mobile/lib/api.ts:83-88`.

Client-side `Dinner` type (`mobile/types/index.ts:46-69`) mirrors this: `date: string`,
`startTime: string`, `area: string`, `exactAddress: string | null`. There is no `end_time` /
duration field anywhere — dinners have no known length in the schema.

`isAddressRevealed()` (`mobile/lib/api.ts:35-39`) is the existing reveal-window check:

```ts
export const ADDRESS_REVEAL_HOURS_BEFORE = 24; // mobile/lib/api.ts:27

export function isAddressRevealed(dinner: Pick<Dinner, "date" | "startTime">): boolean {
  const start = new Date(`${dinner.date}T${dinner.startTime}:00`);
  const hoursUntilStart = (start.getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntilStart <= ADDRESS_REVEAL_HOURS_BEFORE;
}
```

This same `new Date(\`${date}T${startTime}:00\`)` construction is the correct way to build a JS
`Date` for the calendar event start — it's already the pattern used at the one other place a
`Date` object is derived from these two fields. `lib/fridays.ts` is unrelated to this (it only
generates the list of upcoming Friday *dates* for the host's dinner-creation `FridayPicker`; it
has no time-of-day concept and isn't reused for calendar-event construction).

## 2. Where "Add to calendar" should live

`app/dinner/[id]/index.tsx` is the RSVP/confirmation surface (per task framing). Relevant existing
state there:
- `myRsvp: { status: string; paymentStatus: string } | null` — loaded via `fetchMyRsvpForDinner`.
- `StatusBanner` (line 313) renders a banner for `myRsvp.status` of `approved` / `pending` /
  `declined`.
- The bottom-sheet RSVP CTA (`footer`, lines 261-280) is only rendered `!myRsvp` — i.e. once an
  RSVP exists in any state, that CTA disappears and only `StatusBanner` (+ potluck section, if
  eligible) remains.

So the natural insertion point is directly below `<StatusBanner status={myRsvp.status} />`
(line 233), conditioned on the same "confirmed" cases the address-reveal logic already uses:
`myRsvp.status === "approved"` **or** the dinner is free/auto-accept and the RSVP was just created
successfully. Concretely, "confirmed enough to add to calendar" should reuse:
- `myRsvp?.status === "approved"` (host-approved or auto-accepted flows both land here — `handleRsvp`
  passes `autoApprove: dinner.approvalMode === "auto_accept"`, and `createRsvp` presumably sets
  status accordingly), OR
- for `dinner.isFree` dinners with no approval gate, whatever status `createRsvp` actually persists
  (needs one grep at plan/implementation time — not required for this research pass since the UI
  condition `myRsvp?.status === "approved"` is very likely already the single relevant state; the
  `pending`/`declined` cases from `StatusBanner`'s map should NOT show the calendar button).

Do not add the button before any RSVP exists — the footer CTA is for booking, not for calendar
sync, and showing "Add to calendar" pre-RSVP would be misleading (nothing is confirmed yet).

## 3. Platform-split precedent in this codebase

Confirmed existing `.web.tsx` sibling-file pattern (checked via `find`):
- `mobile/lib/payments.tsx` (native) / `mobile/lib/payments.web.tsx` (web) — both export
  `useDinnerCheckout()` returning `{ pay, modal }`. Native uses Stripe's native `PaymentSheet`
  imperative API and returns `modal: null` (nothing to mount — the native sheet is its own overlay).
  Web returns a real `modal: React.ReactNode` (a `<Modal>` wrapping `CheckoutForm.web`) because web
  needs an in-page mount point instead of a native modal.
- `mobile/components/PaymentProvider.web.tsx` and `mobile/lib/donationCheckout.web.tsx` are the
  other two `.web.tsx` siblings in the repo — same idea, Stripe-provider/donation-checkout logic
  that only exists in a web-shaped form because the native side goes through the native SDK
  directly elsewhere.

Metro/Expo's bundler resolves `foo.web.tsx` over `foo.tsx` automatically on web builds — callers
just `import { useDinnerCheckout } from "@/lib/payments"` and get the right file per platform. This
is exactly the shape needed here: expo-calendar has no web implementation, so a
`lib/addToCalendar.ts` (native) + `lib/addToCalendar.web.ts` (web) pair mirrors `lib/payments`
precisely — same reason (no native module on web), same resolution mechanism.

## 4. Native permission pattern already used in this app

Only one existing native permission flow: `mobile/components/PhotoPicker.tsx:14`:

```ts
const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
if (!permission.granted) return;
```

Runtime request, silently no-op on denial (no error toast, no explanation UI) — that's the bar to
match for calendar permission requests via `expo-calendar`'s
`Calendar.requestCalendarPermissionsAsync()`.

Notably, `app.json`'s `plugins` array lists `"expo-image-picker"` as a **bare string**, with no
custom permission-message config object — it relies on the plugin's own default
`NSPhotoLibraryUsageDescription` text. There is no existing precedent in this repo for a plugin
entry with a custom permission-description object (e.g. `["expo-image-picker", { "photosPermission":
"..." }]`), so adding `expo-calendar` should default to matching that minimal-config style unless a
custom message is explicitly wanted.

Expo SDK in use: `"expo": "~57.0.1"` (`mobile/package.json:15`). `expo-calendar` isn't currently a
dependency (confirmed absent from `package.json` and no `.ics`/calendar code anywhere in the repo,
per the task's pre-confirmed facts). It should be added via `npx expo install expo-calendar` from
inside `mobile/` to pick the SDK-57-compatible version rather than hand-picking a version number.

`expo-calendar` requires, at minimum:
- iOS: `NSCalendarsUsageDescription` (and on newer Expo/iOS SDKs, `NSCalendarsFullAccessUsageDescription`
  for full read/write access — the config plugin sets sensible defaults but they read as generic
  boilerplate ("Allow $(PRODUCT_NAME) to access your calendar") unless overridden).
- Android: `READ_CALENDAR` / `WRITE_CALENDAR` permissions, granted automatically by the config
  plugin.
- The config plugin (`expo-calendar`'s `app.plugin.js`) needs to be added to `app.json`'s `plugins`
  array, same slot as `expo-image-picker` / `expo-status-bar` etc.

## 5. Address-reveal timing consideration

Because `exact_address` is gated by `get_dinner_address` until `ADDRESS_REVEAL_HOURS_BEFORE = 24`
hours before `start_time`, and RSVPs are typically created well before that window opens, a
calendar event created at RSVP-confirmation time must NOT contain `exact_address`/`revealedAddress`
— only `dinner.area` should ever be written into the event's `location` field. This is true
regardless of whether the attendee happens to be looking at the dinner detail screen after the
reveal window has already opened (a late RSVP within 24h of the dinner) — using `area` unconditionally
is simpler and safer than conditionally trying to also thread the exact address through, and avoids
ever writing a leaked address into a device calendar that could be seen by anyone with access to
that calendar (shared family calendars, calendar-sync services, etc. — a materially different
exposure surface than the app's own gated RPC).

Re-creating/updating the calendar event once the address reveals is a nice-to-have, not required
for a Tier 1 pass: `expo-calendar`'s `Calendar.updateEventAsync(eventId, {...})` could update
`location` post-reveal if the event's id is persisted (e.g. `AsyncStorage` keyed by dinner id), but
this adds meaningful complexity (needs a background trigger or a "check on app open" hook near the
reveal window) for a case fully covered by the in-app "Where" row already showing the real address
once revealed. The plan below scopes this as an explicit non-goal, notable only as a future
follow-up.

## 6. Web `.ics` fallback

No calendar API exists in browsers exposed to web apps (no File System/Calendar Web API broadly
supported). Standard fallback: generate a minimal `.ics` string client-side and trigger a download
via a `Blob` + temporary `<a href={URL.createObjectURL(blob)} download>` click — no library needed,
this is a well-known ~20-line hand-rolled format (`BEGIN:VCALENDAR` / `VEVENT` / `DTSTART` /
`DTEND` / `SUMMARY` / `LOCATION` / `END:VEVENT` / `END:VCALENDAR`, with `\r\n` line endings per
RFC 5545). Apple Calendar, Outlook, and Google Calendar (via its web "import" flow, not a direct
double-click) all accept a `.ics` download of this shape.

## Summary of grounded findings

| Question | Answer |
|---|---|
| Date/time source | `dinner.date` (`date`) + `dinner.startTime` (`HH:MM`), combine via `new Date(\`${date}T${startTime}:00\`)` — same pattern as `isAddressRevealed()` |
| Duration/end time | Not modeled anywhere in schema; must be assumed (e.g. +3h default) |
| Location field | `dinner.area` only, never `exactAddress`/revealed address |
| Where UI lives | `app/dinner/[id]/index.tsx`, below `StatusBanner`, gated on `myRsvp?.status === "approved"` |
| Platform split precedent | `lib/payments.tsx` / `lib/payments.web.tsx` (also `PaymentProvider.web.tsx`, `donationCheckout.web.tsx`) — Metro auto-resolves `.web.tsx` |
| Native permission precedent | `PhotoPicker.tsx`'s `requestMediaLibraryPermissionsAsync()` — silent no-op on denial, no custom app.json permission strings currently used anywhere |
| Expo SDK | `~57.0.1` — install `expo-calendar` via `npx expo install expo-calendar` |
| Web fallback | Hand-rolled `.ics` string + Blob/anchor download, no library |

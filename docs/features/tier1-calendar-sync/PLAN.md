# Tier 1: Calendar Sync — Plan

Planning deliverable only — nothing in this doc has been implemented. See `RESEARCH.md` in this
same directory for the grounding this plan relies on.

## Goal

Once an attendee's RSVP is confirmed (`approved`), let them add the dinner to their device calendar
(native) or download a `.ics` file (web) — title, correct start/end time from `dinner.date` +
`dinner.startTime`, and `dinner.area` as the location. Never write the exact address into any
calendar artifact.

## New files

### `mobile/lib/addToCalendar.ts` (native)

```ts
import * as Calendar from "expo-calendar";
import type { Dinner } from "@/types";

export interface CalendarResult {
  ok: boolean;
  error?: string;
}

const DEFAULT_DURATION_HOURS = 3; // no end-time field in schema; Shabbat dinners run long, 3h is a
                                   // reasonable placeholder — revisit if a real duration is ever modeled

function buildEvent(dinner: Dinner) {
  const startDate = new Date(`${dinner.date}T${dinner.startTime}:00`);
  const endDate = new Date(startDate.getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000);
  return {
    title: `Shabbat dinner with ${dinner.hostName}`,
    startDate,
    endDate,
    location: dinner.area, // never exact_address / revealed address — see RESEARCH.md §5
    notes: "Hosted via Shishi. Check the app closer to Friday for the exact address.",
  };
}

export async function addDinnerToCalendar(dinner: Dinner): Promise<CalendarResult> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== "granted") return { ok: false, error: "permission_denied" };

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const defaultCalendar =
      calendars.find((c) => c.allowsModifications) ?? calendars[0];
    if (!defaultCalendar) return { ok: false, error: "no_calendar" };

    const event = buildEvent(dinner);
    await Calendar.createEventAsync(defaultCalendar.id, event);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : undefined };
  }
}
```

Notes:
- Mirrors `PhotoPicker.tsx`'s permission-request shape (request, check `.granted`/`status`, bail
  quietly-ish on denial — here surfaced via `CalendarResult.error` so the caller can toast it,
  slightly more informative than PhotoPicker's silent return but same one-shot-request pattern, no
  settings-deep-link flow).
  `defaultCalendar` picks any writable calendar rather than assuming a `getDefaultCalendarAsync()`
  API path — iOS has `Calendar.getDefaultCalendarAsync()` but Android does not expose an equivalent,
  so picking the first modifiable calendar from `getCalendarsAsync` is the cross-platform-safe
  approach.

### `mobile/lib/addToCalendar.web.ts` (web)

```ts
import type { Dinner } from "@/types";

export interface CalendarResult {
  ok: boolean;
  error?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Local-time ICS timestamp (no trailing "Z" — this is a wall-clock time in Israel, not UTC).
function toIcsLocal(date: Date): string {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T` +
    `${pad(date.getHours())}${pad(date.getMinutes())}00`
  );
}

const DEFAULT_DURATION_HOURS = 3;

function buildIcs(dinner: Dinner): string {
  const start = new Date(`${dinner.date}T${dinner.startTime}:00`);
  const end = new Date(start.getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shishi//Dinner//EN",
    "BEGIN:VEVENT",
    `UID:${dinner.id}@shishi.org`,
    `DTSTART:${toIcsLocal(start)}`,
    `DTEND:${toIcsLocal(end)}`,
    `SUMMARY:Shabbat dinner with ${dinner.hostName}`,
    `LOCATION:${dinner.area}`,
    "DESCRIPTION:Hosted via Shishi. Check the app closer to Friday for the exact address.",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

export async function addDinnerToCalendar(dinner: Dinner): Promise<CalendarResult> {
  try {
    const ics = buildIcs(dinner);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shishi-dinner-${dinner.id}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : undefined };
  }
}
```

Both files export the same `addDinnerToCalendar(dinner): Promise<CalendarResult>` signature so the
call site doesn't need any `Platform.OS` branching — same contract shape as `useDinnerCheckout()`
in `lib/payments.tsx` / `lib/payments.web.tsx`, just a plain async function instead of a hook since
there's no modal/state to manage on either platform.

## `app.json` changes

Add `expo-calendar` to the `plugins` array (`mobile/app.json`), matching the existing minimal-config
style used for `expo-image-picker` (no custom permission-message object unless product wants
custom copy later):

```jsonc
"plugins": [
  "expo-router",
  "expo-status-bar",
  "expo-secure-store",
  "expo-image-picker",
  "expo-calendar",
  [
    "@stripe/stripe-react-native",
    { "merchantIdentifier": "merchant.org.shishi", "enableGooglePay": true }
  ],
  "expo-image",
  "expo-localization"
]
```

Add the dependency: `cd mobile && npx expo install expo-calendar` (picks the SDK-57-compatible
version automatically — do not hand-pin a version number).

No `mobile/package.json` hand-edit needed beyond what `expo install` writes.

## UI wiring — `app/dinner/[id]/index.tsx`

Insert directly below the existing `{myRsvp ? <StatusBanner status={myRsvp.status} /> : null}`
block (current line 232-234), gated on the same "confirmed" condition:

```tsx
{myRsvp?.status === "approved" ? (
  <Button
    label="Add to calendar"
    variant="secondary"
    size="sm"
    onPress={handleAddToCalendar}
    loading={addingToCalendar}
    style={styles.addToCalendar}
  />
) : null}
```

New state + handler alongside the existing `submitting` state:

```tsx
const [addingToCalendar, setAddingToCalendar] = useState(false);

async function handleAddToCalendar() {
  if (!dinner) return;
  setAddingToCalendar(true);
  try {
    const result = await addDinnerToCalendar(dinner);
    if (result.ok) {
      haptics.success();
      show("Added to your calendar.", "success");
    } else if (result.error === "permission_denied") {
      show("Enable calendar access in Settings to add this dinner.", "error");
    } else {
      show("Couldn't add this to your calendar.", "error");
    }
  } finally {
    setAddingToCalendar(false);
  }
}
```

Import: `import { addDinnerToCalendar } from "@/lib/addToCalendar";` — Metro resolves `.web.ts` on
web automatically, same as every `lib/payments` import site.

Why gate on `myRsvp?.status === "approved"` specifically (not "RSVP exists"): `StatusBanner`'s own
map (line 314-318) treats `pending` and `declined` as distinct, non-confirmed states — showing
"Add to calendar" for a `pending` request-to-join or a `declined` RSVP would be actively wrong
(nothing is actually happening at that dinner for this user yet). This condition already matches
what `canClaimPotluck` uses one line below it (`myRsvp?.status === "approved"`, line 119) for
gating potluck claims — same trust threshold, reused rather than invented.

Confirmed against `createRsvp` in `mobile/lib/api.ts:249-270`: it inserts
`status: opts.autoApprove ? "approved" : "pending"` (both the mock branch and the real Supabase
insert), and `handleRsvp` in `index.tsx` passes `autoApprove: dinner.approvalMode === "auto_accept"`.
So free/auto-accept dinners do land on `myRsvp.status === "approved"` immediately after `load()`
re-fetches — the `myRsvp?.status === "approved"` gate above covers both the "host approved a
request-to-join" and "auto-accept dinner" cases with no special-casing needed.

Style addition (near the existing `styles.report` entry):

```ts
addToCalendar: { alignSelf: "center", marginTop: spacing.sm },
```

## Event field mapping

| ICS/Calendar field | Source |
|---|---|
| Title / SUMMARY | `` `Shabbat dinner with ${dinner.hostName}` `` |
| Start | `new Date(\`${dinner.date}T${dinner.startTime}:00\`)` |
| End | Start + 3h (`DEFAULT_DURATION_HOURS`, no schema field for actual duration) |
| Location | `dinner.area` — **never** `exactAddress` / `fetchDinnerAddress()` result |
| Notes/Description | Static string pointing back to the app for the address |

## Explicit non-goals (this pass)

- No re-creation/update of the calendar event once the address-reveal window opens (`RESEARCH.md`
  §5) — the in-app "Where" row already shows the real address once revealed; syncing that into an
  already-created device calendar event would need persisted event-id tracking + a background or
  app-open trigger, out of scope for Tier 1.
- No "remove from calendar" action if an RSVP is later cancelled/declined after having been
  approved — same reasoning, deferred.
- No custom `NSCalendarsUsageDescription` copy in `app.json` beyond the plugin default, matching
  the existing `expo-image-picker` precedent of not overriding permission strings.

## Verification

### Native (iOS simulator)
1. Run `npx expo prebuild` (or a dev build) after adding the `expo-calendar` plugin, since it's a
   config plugin requiring a native rebuild — won't work in plain Expo Go without a custom dev
   client that includes it.
2. RSVP to a free/auto-accept dinner (or get a host to approve a request-to-join dinner) in the
   simulator.
3. Confirm the "Add to calendar" button appears once `myRsvp.status === "approved"` and not before
   (check a `pending` dinner shows no button).
4. Tap it, accept the calendar permission prompt, confirm a new event appears in the iOS Calendar
   app with:
   - Correct title (`Shabbat dinner with <host name>`).
   - Correct start time matching `dinner.startTime` in local (Israel) time, and a 3h duration.
   - Location field showing only `dinner.area` (e.g. "Florentin, Tel Aviv"), never a street
     address — cross-check against what `fetchDinnerAddress`/the "Where" row shows for the same
     dinner to confirm they differ pre-reveal.
5. Deny the permission prompt on a fresh install/reset permissions and confirm the error toast
   ("Enable calendar access in Settings...") shows instead of a crash or silent failure.

### Web
1. Run the web build (`npx expo start --web` or the deployed web build).
2. RSVP to a dinner as above, confirm the same button appears under the same condition.
3. Click "Add to calendar", confirm a `shishi-dinner-<id>.ics` file downloads.
4. Open the downloaded `.ics` in:
   - macOS/iOS Calendar.app (double-click / share-sheet import) — confirm event appears with
     correct local start/end time and title.
   - Google Calendar's web "Import" (Settings → Import & export) — confirm same.
   - Outlook (web or desktop, "Open" on the `.ics`) — confirm same, and specifically confirm no
     timezone shift (the `DTSTART`/`DTEND` values are written as local/floating time, not UTC — a
     timezone mismatch here is the most likely thing to silently break on one of these three
     targets and is worth explicitly re-checking against each).
5. Confirm `LOCATION` in the downloaded `.ics` text (open it in a text editor) is `dinner.area`
   only — grep for the dinner's actual street address string to make sure it never appears in the
   generated file.

### Regression check
- Confirm dinners with `myRsvp === null` (no RSVP yet) still show the original booking footer CTA
  and no calendar button — the two are mutually exclusive per the existing `!myRsvp` gate on the
  footer.
- Confirm a `declined` RSVP shows only the existing red `StatusBanner`, no calendar button.

# Plan: Recurring Host Mode (dinner templates)

Scope per `RESEARCH.md`: semi-automated "start from template" pre-fill. **Not** in scope: full
auto-recurrence (no scheduled/unattended dinner creation), potluck-item templating.

## 1. Migration — `dinner_templates` table

New file: `supabase/migrations/20260728120000_dinner_templates.sql`

```sql
-- Recurring host mode (product bible §5.3, V2): lets a host save a dinner's non-date fields as a
-- reusable template, then pre-fill app/dinner/create.tsx from it next week instead of re-typing
-- everything. Deliberately NOT a scheduler — see docs/features/tier2-recurring-host-mode/RESEARCH.md
-- §4 for why full auto-recurrence is out of scope: no row here ever becomes a dinner without the
-- host explicitly reviewing and publishing it, mirroring the sponsor_approved "review before it's
-- real" gate already used on `dinners`.

create table dinner_templates (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references profiles (id) on delete cascade,
  -- Optional human-friendly label so a host with more than one recurring setup (e.g. "Friday
  -- potluck" vs. "small intimate table") can tell templates apart in a picker. Falls back to
  -- "Untitled template" client-side if null.
  name text,

  -- Mirrors the `dinners` authoring fields exactly, minus date-specific / lifecycle columns
  -- (date, sponsor_approved, amount_funded, status — see RESEARCH.md §5). start_time IS included:
  -- it's a stable weekly habit ("always 19:30"), not a per-instance choice.
  start_time time not null,
  capacity integer not null check (capacity > 0),
  area text not null,
  exact_address text,
  kosher_level kosher_level not null,
  cost_per_head numeric not null default 0,
  is_free boolean not null default true,
  description text not null,
  approval_mode approval_mode not null default 'host_approves',
  budget_needed numeric,
  seeking_sponsorship boolean not null default false,
  dinner_type_tags text[] not null default '{}',

  created_at timestamptz not null default now()
);

alter table dinner_templates enable row level security;

-- Scoped entirely to the owning host — a template is a private authoring shortcut, not a public
-- listing (unlike `dinners`, which is readable by all authenticated users). No one else needs to
-- see, insert, update, or delete another host's templates.
create policy "hosts manage their own templates" on dinner_templates
  for all using (auth.uid() = host_id) with check (auth.uid() = host_id);
```

Notes:
- `dinner_type_tags` reuses the existing `text[]` pattern from `dinners`, no new enum/type needed.
- No trigger/function is required — this table has no derived columns and no cross-table side
  effects (contrast `update_dinner_amount_funded()` on `dinners`).
- No column-privilege lock (contrast `dinners.exact_address`): the RLS policy already scopes every
  operation to `auth.uid() = host_id`, so there's no cross-host row to leak an address from — the
  `dinners` lock exists because *other authenticated users* can see rows they don't own; that's
  never true here.

## 2. API layer — `mobile/lib/api.ts`

Add alongside the existing `createDinner`/`fetchMyHostedDinners` functions:

```ts
export interface DinnerTemplate {
  id: string;
  hostId: string;
  name: string | null;
  startTime: string;
  capacity: number;
  area: string;
  exactAddress: string | null;
  kosherLevel: KosherLevel;
  costPerHead: number;
  isFree: boolean;
  description: string;
  approvalMode: ApprovalMode;
  budgetNeeded: number | null;
  seekingSponsorship: boolean;
  dinnerTypeTags: string[];
  createdAt: string;
}

const TEMPLATE_COLUMNS =
  "id, host_id, name, start_time, capacity, area, exact_address, kosher_level, cost_per_head, " +
  "is_free, description, approval_mode, budget_needed, seeking_sponsorship, dinner_type_tags, created_at";

function rowToTemplate(row: any): DinnerTemplate { /* snake_case -> camelCase, mirrors rowToDinner */ }

export async function fetchMyDinnerTemplates(hostId: string): Promise<DinnerTemplate[]>
// select * where host_id = hostId order by created_at desc; mock-data branch returns [] (or an
// in-memory mock array) when useMockData(), matching the mockDinners pattern.

export interface CreateDinnerTemplateInput { hostId: string; name: string | null; /* + all fields above minus id/hostId/createdAt */ }
export async function createDinnerTemplate(input: CreateDinnerTemplateInput): Promise<DinnerTemplate>

export async function deleteDinnerTemplate(id: string, hostId: string): Promise<void>
// delete where id = id and host_id = hostId (defense in depth; RLS already scopes this)
```

`useMockData()` branches follow the existing `mockDinners`-style in-memory array so demo mode keeps
working without a real Supabase project (add a `mockDinnerTemplates` array to `mobile/data/mock.ts`
next to `mockDinners`).

## 3. UI changes — `app/dinner/create.tsx`

**a) Template picker at the top of the flow.**
On mount, `fetchMyDinnerTemplates(profile.id)`. If any exist, render a compact section above the
`Date` label:

```tsx
{templates.length > 0 && (
  <View style={styles.templateBlock}>
    <Text style={styles.label}>Start from a template</Text>
    <View style={styles.chipRow}>
      {templates.map((t) => (
        <Chip
          key={t.id}
          label={t.name ?? "Untitled template"}
          selected={selectedTemplateId === t.id}
          onPress={() => applyTemplate(t)}
        />
      ))}
    </View>
  </View>
)}
```

`applyTemplate(t)` sets every non-date state field from the template (`startTime`, `capacity`,
`area`, `exactAddress`, `kosherLevel`, `isFree`, `costPerHead`, `description`, `approvalMode`,
`seekingSponsorship`, `budgetNeeded`, `dinnerTypeTags`) and leaves `date` as whatever
`FridayPicker` currently has (default `nextFriday()`, still host-editable) — satisfying "pre-fills
... for the next available Friday" while keeping the date control exactly as it works today. This
is additive: the form is not read-only afterward, every field stays editable, and "Publish dinner"
behaves exactly as it does now.

Entry point note: this same picker doubles as the "start from template" entry point named in the
task — no separate route/screen is needed since `app/dinner/create.tsx` is already the single
create surface and templates are just a pre-fill source for it.

**b) "Save as template" after a successful create.**
After `createDinner()` succeeds in `handleSubmit`, instead of immediately `router.replace(...)`,
show a lightweight inline confirmation step:

```tsx
async function handleSubmit() {
  if (!profile || !kosherLevel) return;
  setSubmitting(true);
  try {
    await createDinner({ /* unchanged */ });
    if (saveAsTemplate) {
      await createDinnerTemplate({
        hostId: profile.id,
        name: templateName.trim() || null,
        startTime, capacity: Number(capacity), area, exactAddress, kosherLevel,
        costPerHead: isFree ? 0 : Number(costPerHead), isFree, description, approvalMode,
        budgetNeeded: seekingSponsorship ? Number(budgetNeeded) : null, seekingSponsorship,
        dinnerTypeTags,
      });
    }
    router.replace("/(tabs)/my-dinners");
  } finally {
    setSubmitting(false);
  }
}
```

New state: `saveAsTemplate` (bool, default `false`) and `templateName` (string, only shown/used
when `saveAsTemplate` is true), rendered as a `Switch` + conditional `TextField` directly above the
`Button label="Publish dinner"` — same `Reveal`-on-toggle pattern already used for the sponsorship
block (lines 139–164 of the current file), for visual consistency:

```tsx
<View style={styles.row}>
  <Text style={styles.label}>Save these details as a template?</Text>
  <Switch value={saveAsTemplate} onValueChange={setSaveAsTemplate} trackColor={{ true: colors.brand }} />
</View>
{saveAsTemplate ? (
  <Reveal>
    <TextField
      label="Template name (optional)"
      value={templateName}
      onChangeText={setTemplateName}
      placeholder="Friday night regulars"
      style={{ marginTop: spacing.sm }}
    />
  </Reveal>
) : null}
```

Placement: after the sponsorship block, immediately before the publish button, since it's about
"what happens after this dinner," not the dinner's own content.

**c) Template deletion** is out of scope for the initial UI pass (host can accumulate a handful of
named templates; a "manage templates" screen is a natural follow-up, not required for the
save → start-from flow to work end-to-end).

## 4. Types

Add `DinnerTemplate` to `mobile/types/index.ts` alongside `Dinner`, mirroring the interface in §2.
No changes needed to `types/database.ts` — `KosherLevel`/`ApprovalMode` enums are reused as-is.

## 5. Verification

Manual UAT (no automated test infra currently exists for this flow, per `mobile/app/dinner/create.tsx`
having no adjacent test file — matches the rest of the app):

1. **Create a dinner.** As a host, fill out `app/dinner/create.tsx` fully (all required fields per
   the existing `canSubmit` check) and toggle "Save these details as a template?" on with a name,
   e.g. "Friday regulars." Publish. Confirm the dinner appears in `my-dinners` as today.
2. **Confirm the template persisted.** Query `dinner_templates` (Supabase Studio or a quick
   `fetchMyDinnerTemplates` call) and confirm one row exists with `host_id` matching the host and
   every field matching what was entered — `date`/`status`/`sponsor_approved`/`amount_funded`
   should not appear on this row at all (they're not columns).
3. **Start a new dinner from that template.** Re-open `app/dinner/create.tsx`. Confirm the
   "Start from a template" chip row shows "Friday regulars." Tap it and confirm every field
   pre-fills: start time, capacity, area, exact address, kosher level, free/cost, description,
   approval mode, sponsorship toggle + budget, and tags. Confirm the date still defaults to
   `nextFriday()` (the *next* upcoming Friday relative to today, not the original dinner's date)
   and remains changeable via `FridayPicker`.
4. **Confirm host can still edit before publishing.** Change at least one pre-filled field (e.g.
   capacity) and one date-only field (pick a different upcoming Friday via the chip picker).
   Publish. Confirm the resulting dinner reflects the edited values, not the raw template values —
   proving pre-fill never bypasses the review/edit/publish step.
5. **RLS check.** As a second host account, confirm `fetchMyDinnerTemplates` returns none of the
   first host's templates, and a direct `dinner_templates` select/update/delete against the first
   host's template id is rejected by RLS.
6. **Demo mode check.** With `isSupabaseConfigured` false (or an active demo session), repeat
   steps 1 and 3 and confirm the mock in-memory path works with no Supabase project connected,
   matching how `mockDinners` already behaves.

Feature is considered done when all six steps pass and no dinner is ever created without a host
explicitly hitting "Publish dinner" on a reviewable, editable form — i.e. the "review before it's
real" property holds even when the form started from a template.

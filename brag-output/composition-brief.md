# Hyperframes Composition Brief: Shishi

## Objective
Create a short launch-style brag video for Shishi.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds (15-25s range)

## Source Material
- Project root: `/Users/ethansaba/code/Shishi`
- Primary files read: `docs/PRODUCT_BIBLE.md`, `mobile/package.json`, `mobile/constants/theme.ts`, `mobile/constants/options.ts`, `mobile/components/landing/DesktopLanding.tsx`, `mobile/app/(auth)/welcome.tsx`, `mobile/components/SponsorDinnerCard.tsx`, `mobile/app/dinner/[id]/donate.tsx`, and the reference screenshots `role-select.png`, `role-select-2.png`, `landing-1.png`, `rsvp-success-overlay.png` at the repo root
- Product name: Shishi
- Tagline / strongest claim: "A seat at the table for every Jew who wants one."
- Key UI or visual moment to recreate: the desktop landing hero's candlelight gradient (brandDark→brand diagonal with soft drifting glow circles behind the ש logomark); the onboarding role-select cards; the Discover feed (map + dinner card) → RSVP confirmed → potluck checklist; the sponsor donor-feed funding-progress bar
- Copy that must appear verbatim:
  - "A seat at the table for every Jew who wants one."
  - "SHABBAT DINNERS · TEL AVIV"
  - "What brings you to Shishi?"
  - "Find a Shabbat table" / "Browse dinners and RSVP for a seat."
  - "Host a Shabbat" / "Open your home and gather a table."
  - "Sponsor a Shabbat" / "Fund dinners for people who need a table."
  - "You're confirmed for this dinner."
  - "~$2B given to Israeli causes from abroad each year."

## Creative Direction
- Tone preset: `polished`
- Creative direction: Friday-night candlelight — a quiet, premium invitation, not a hype reel. Restraint reads as sincerity; this is a mission product about belonging, not a startup flex.
- Interpretation: Slow crossfades (0.6-0.8s), generous holds, serif display type used sparingly and at real scale. No aggressive typography, no rapid cuts, no forced jokes. Confidence comes from unhurried pacing and letting the product's own warmth (color, type, copy) carry the video.
- Angle: The video treats the product the way the app treats Shabbat itself — warmly, unhurriedly, candlelit. The hook is the app's own hero line, not an invented joke or stat. Everything after just proves the line is true: three ways in, a real dinner found and confirmed, and the sponsorship engine that makes it possible.
- Hook: Candlelight gradient, ש wordmark settling at full scale, small eyebrow above it.
- Outro / punchline: Same hook line returns as a closing statement over the same gradient: "A seat at the table for every Jew who wants one." Hold, fade.
- Avoid:
  - Generic SaaS language ("streamline," "workflow," etc.)
  - Abstract filler visuals — every scene must show real Shishi UI, copy, or the candlelight brand treatment
  - Unrelated visual redesign — use the app's actual palette, type, and component shapes, not a reinterpretation

## Visual Identity
- Background: `#FFF7F9` (app bg), surface `#FFFFFF`, surface muted `#FFF0F4`
- Text: `#241419` (primary), `#8A6B73` (secondary)
- Accent: `#E11D48` (brand rose-red), `#9F1239` (brand dark, for gradients), `#FFE1EA` (brand soft)
- Display font: Frank Ruhl Libre (serif — headings, wordmark). Fallback: a warm serif such as "Georgia" or a Google Fonts equivalent if the exact family isn't available in the render environment.
- Body font: Rubik (geometric sans — UI, body). Fallback: a clean geometric sans such as "Inter" or "Helvetica Neue" if unavailable.
- Visual references from the project: the candlelight gradient hero (`DesktopLanding.tsx`), the role-select onboarding cards (`role-select.png`, `role-select-2.png`), the Discover feed and dinner-detail/RSVP-confirmed screen (`landing-1.png`, `rsvp-success-overlay.png`), the `SponsorDinnerCard` funding-progress bar pattern

## Storyboard
Use the full storyboard in `brag-output/brag-plan.md` as the creative contract. Scene summary:

1. **Hook** — 4s — Candlelight gradient (`#9F1239`→`#E11D48`) with drifting glow blobs; ש wordmark settles at full scale; eyebrow "SHABBAT DINNERS · TEL AVIV" above it. No motion tricks.
2. **The three ways in** — 5s — Onboarding role-select recreation on `#FFF7F9` bg: "What brings you to Shishi?" then 3 real role cards (find a table / host / sponsor) arrive one by one with icon, title, subcopy, checkmark landing.
3. **Finding a table** — 7s — Discover feed (map + Jonathan Levi's dinner card: avatar, "Hosted 6 Shabbats," Friday date, Kosher, Free, "3 seats left") → simulated tap/RSVP → "You're confirmed for this dinner" banner → potluck checklist row settles in after.
4. **What makes it possible / outro** — 4s — Sponsor donor-feed card with funding-progress bar filling 0→target, paired with "~$2B given to Israeli causes from abroad each year"; then crossfade back to the candlelight gradient, wordmark + hook line returning as the closing line, hold, fade to black.

## Audio
- Audio role: warm bed, restrained — a quiet companion, not a driver
- Audio arc: enters quiet under the hook, stays gentle through the role cards and discover flow, one warm confirm chime as the emotional peak on the RSVP moment, fades back down under the closing wordmark
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (the skill's tone table recommends this track for `polished`/`cinematic` — "steady and clean")
- Music treatment: volume ~0.25-0.3 (below the normal 0.3-0.4 band, since the tone wants extra restraint), fade in over the first ~1s of the hook, fade down under the final wordmark hold, no hard swell or drop
- Music cue guidance: bundled preset at `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json` and `.md`. Strong cue at 17.47s (intensity 0.99) lands at the start of Scene 4 — lock the funding-bar reveal to it (`// beat-locked: 17.47s`). Use only this one strong-cue lock given the restrained tone. Snap the Scene 2 role-card arrivals to the natural beat grid (~0.55s spacing at 109.96 BPM) only if it doesn't rush their readability — each card still needs its ~0.8s settled hold.
- Audio-reactive treatment: none — this tone wants stillness, not visible music-reactivity
- Audio-coupled moments:
  - Scene 2 role cards — soft interface tick timed to each card's settle (not its slide-in)
  - Scene 3 RSVP confirmation — warm confirm chime exactly on the "You're confirmed" banner's arrival; a smaller, quieter tick when the potluck row settles in after
  - Scene 4 funding bar — quiet rising shimmer synced to the bar's fill motion, beat-locked to 17.47s
- SFX selection guidance: minimal but present, matching the `polished` energy band from `audio.md` — 2-3 very subtle SFX total. Favor `interface/drop_001` or `_002` for gentle reveals/card settles, and a soft bell/chime (e.g. `interface/bong_001` or a low `impact/impactBell_heavy_*` at reduced volume) for the RSVP confirm moment. Nothing aggressive, no click/switch sounds that read as mechanical.
- SFX analysis guidance: read `skills/brag/assets/sfx/sfx-analysis.md` (or `~/.claude/skills/brag/assets/sfx/sfx-analysis.md` when running from the installed skill) and prefer low/medium high-frequency-risk files, since these are repeated, polished moments.
- Exact SFX choice: Hyperframes should choose exact filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copy the chosen music (and its cue JSON/MD) and any Hyperframes-selected SFX into `brag-output/composition/assets/`.

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core` (composition contract + `data-*` timing), `hyperframes-animation` (motion), `hyperframes-creative` (design spec, beats, audio-reactive), `hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli` (lint/check/render). `/brag` is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project (Scenes 2-4 all do; this is non-negotiable per the brand's "show the thing" law).
- Keep all text readable in the final render — respect the reading-time floors from `step-2-plan.md` (short label ~0.8s settled; sentence ~0.3s/word, min ~1.2s), especially for the hook line and the role-card copy.
- Keep the video within 15-25 seconds (target 20s; scenes sum to 4+5+7+4).
- Include the planned music/SFX layer — audio was not disabled and is not intentionally silent.
- Treat `/brag`'s audio notes as guidance, not a fixed cue sheet. Choose exact SFX files after the visual animation exists.
- Treat music cue metadata as an optional timing hint. Lock only the Scene 4 funding-bar reveal to the 17.47s strong cue; use natural timing elsewhere if it serves readability or pacing better.
- Use local assets for audio and any required runtime/media dependencies when possible.
- Run `hyperframes check` before render — it is brag's single gate.

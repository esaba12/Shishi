# Video Brief: Shishi

## Decision: reuse existing render, do not re-run /brag

A full `/brag` pass already exists at `brag-output/` (`shishi-brag.mp4`, `shishi-brag.jpg`, `brag-plan.md`, `composition-brief.md`, full Hyperframes composition + snapshots), rendered 2026-07-28 19:58 — the same day as the last major visual-polish commit (`3a382d3`, 19:15) and just before two Discover-map-specific fixes (`933e5d5`, `e584deb`, 19:59–20:22). Those two later fixes are about the live Leaflet map's rendering/framing bugs; the video's Discover scene is a bespoke Hyperframes recreation of the screen, not a live embed, so it isn't affected by them. Reviewed the poster (`shishi-brag.jpg`) and a mid-video snapshot directly — both match the brief exactly (candlelight gradient, ש wordmark, "A seat at the table for every Jew who wants one.", Frank Ruhl Libre display type) and read as current and polished.

## Tone / hook / show-the-thing (for reference, already realized in the existing render)
- Tone: `polished` — restrained, candlelit, mission-driven, not a hype reel.
- Hook: "A seat at the table for every Jew who wants one."
- Show-the-thing: candlelight-gradient hero (bookend) → three role cards → Discover feed RSVP → "You're confirmed for this dinner" + potluck checklist payoff → sponsor funding stat → close on the hook line again.
- Format: landscape 1920x1080, 28.6s.

## Next step
Skip straight to integration (README GIF + link, website video/poster fields + modal) using the existing `brag-output/shishi-brag.mp4` and `brag-output/shishi-brag.jpg` as the source files — see task list item "Shishi: wire video into README and website."

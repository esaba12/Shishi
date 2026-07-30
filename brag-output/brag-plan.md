# Brag Plan: Shishi

## What is this app?
Shishi is a three-sided platform — sponsors, hosts, and attendees — that funds and organizes Shabbat dinners in Tel Aviv, turning outside generosity into a warm table for people who'd otherwise eat Friday night alone.

## The angle
Not a hype reel. A quiet invitation. The video treats the product the way the app treats Shabbat itself: warmly, unhurriedly, candlelit. The hook isn't a joke or a stat — it's the line the app already uses on its own hero screen: "A seat at the table for every Jew who wants one." Everything after that just proves the line is true — three ways in, a real dinner found and confirmed, and the sponsorship engine that makes it possible.

## Hook (first 2-3 seconds)
Full-bleed candlelight gradient (brandDark → brand, diagonal), soft glow blobs breathing in the background. The Shishi ש wordmark settles into frame at full scale, small eyebrow above it: "SHABBAT DINNERS · TEL AVIV." No motion tricks — the confidence is in the restraint.

## Key moments (the middle)
- The onboarding role cards ("What brings you to Shishi?") arriving one by one — find a table / host a Shabbat / sponsor a Shabbat — establishing the three-sided premise fast, using the app's actual copy and icon language.
- The Discover feed: map pins across the Tel Aviv coastline, a host's dinner card sliding in (real card shape — avatar, "Hosted 6 Shabbats," Friday date, "3 seats left").
- The RSVP flip to confirmed — green "You're confirmed for this dinner" banner appearing, then a potluck checklist row settling in beneath it. This is the payoff of the whole flow: a stranger now has a seat.
- The sponsor funding bar filling in on a donor-feed card, paired with the app's own stat: "~$2B given to Israeli causes from abroad each year" — the unspoken engine behind the seat.

## Outro / punchline
Cut back to the candlelight gradient. Wordmark. The same hook line settles a second time, now as a closing statement instead of an opener: "A seat at the table for every Jew who wants one." Hold. Fade.

## User flow worth showing
Entry → key action → result, pulled straight from the attendee journey:
1. **Entry:** Discover feed — map + dinner cards near the user in Tel Aviv.
2. **Key action:** RSVP on Jonathan Levi's Friday dinner (Florentin, kosher, 3 seats left).
3. **Result:** "You're confirmed for this dinner" + potluck checklist ("Bottles of wine — 0 of 2 claimed — I'll bring this").

## Tone
- Preset: `polished`
- Creative direction: "Friday-night candlelight — a quiet, premium invitation, not a hype reel. Restraint reads as sincerity here; this is a mission product about belonging, not a startup flex."
- Interpretation: Slow crossfades, generous holds, serif display type used sparingly and at real scale. No aggressive typography, no rapid cuts, no forced jokes. Confidence comes from unhurried pacing and letting the product's own warmth (color, type, copy) carry the video.

## Format: landscape — 1920x1080
## Duration: 28.6s (revised — see "Revision notes" below)

## Revision notes (v2)
The first pass read as web-page-in-a-video: centered-and-floating single focal points, thin 1-2 layer scenes, uniform entrance vectors, and light backgrounds with no texture. Rebuilt per `hyperframes-creative`'s video-composition/house-style/motion-principles guidance:
- Every scene now has real depth: background (grain texture + oversized ghost-type watermark, brand-tinted) / midground (the real content) / foreground (structural rules, edge-anchored labels/tags).
- Zone-based, edge-anchored layouts replace centered stacks — role cards widened to 1560px, discover/map split to ~820px each with a divider rule, funding scene rebuilt as a true split-frame (giant "~$2B" hero stat left, funding card right).
- Entrance vectors and eases vary per element (left-slide, right-slide, scale, y-rise; power3/expo/back mixed) instead of repeating the same y+opacity tween.
- Ambient motion added to every decorative during holds (icon breathe, pin pulse, ghost-type drift) — nothing static.
- Pacing slowed and given more weight: scene holds extended, transitions upgraded from plain crossfade to blur-crossfade (medium for 2 of 3, a heavier "Calm" blur-crossfade with hold as the boldest accent into the finale — the narrative pivot).
- Confirmed-view given an actual payoff treatment: a green ambient-glow bloom + giant ghost checkmark behind the confirmation banner.

## Visual identity (from the project)
- Background: `#FFF7F9` (barely-there pink white — app bg)
- Surface: `#FFFFFF`, muted surface `#FFF0F4`
- Accent / brand: `#E11D48` (rose-red primary), `#9F1239` (brand dark, for gradients), `#FFE1EA` (brand soft / pink tint)
- Text: `#241419` (primary), `#8A6B73` (secondary)
- Display font: Frank Ruhl Libre (serif — headings, wordmark; strong Hebrew heritage feel)
- Body font: Rubik (geometric sans — UI, body; full Hebrew + Latin coverage)
- Strongest visual element: the desktop landing hero's "candlelight" treatment — brandDark→brand diagonal gradient with soft drifting glow circles behind the ש logomark. This is the video's signature visual and should bookend the piece (hook + outro).

## Share copy (draft)
Shabbat shouldn't be something you're missing. Shishi connects sponsors, hosts, and anyone looking for a seat at the table — starting in Tel Aviv. 🕯️

## Audio direction
- Role: warm bed, restrained — a quiet companion, not a driver
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (109.96 BPM, "steady and clean") — the skill's own tone table recommends this track specifically for `polished`/`cinematic`; mix it warmer/lower than its native "business moves" energy so it reads as intimate rather than corporate-upbeat
- Music treatment: starts soft under the hook (low volume, no percussion transient on the wordmark itself), gently rises into the flow scenes, settles back down for the outro hold; no hard swell, no drop
- Music cue guidance: bundled preset at `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`. Strong cue at 17.47s (intensity 0.99) lands almost exactly at the start of Scene 4 (16s) — lock the funding-bar reveal / stat callout to it. Leave the role-card sequence in Scene 2 on the natural beat grid (~0.55s spacing at this tempo) rather than forcing hard syncs; only use one strong-cue lock in this video given the restrained tone.
- Audio-reactive treatment: none — this tone wants restraint, not visible music-reactivity
- SFX posture: sparse, tasteful — one soft interface tick per role card as it arrives, one warm confirm chime on the RSVP banner, a subtle soft shimmer under the funding-bar fill; nothing percussive or game-like
- Audio-coupled moments: role cards arriving one by one (soft tick per card), RSVP banner confirm (chime), funding bar filling (shimmer/rise, beat-locked to 17.47s)
- Restraint rule: no whooshes, no cartoon stingers, no beat-locked flashing — this is a candlelit invitation, not an ad for a logistics app

## Storyboard

### Scene 1 — Hook — 4s
Full-bleed candlelight gradient (`#9F1239` → `#E11D48`, diagonal), 2-3 soft glow blobs drifting slowly. Shishi ש wordmark (Frank Ruhl Libre) settles into center at full scale. Eyebrow line above in Rubik, small caps: "SHABBAT DINNERS · TEL AVIV."
Sequential/interaction: none
Audio intent: quiet, warm entrance — music fades in under the gradient, no percussive hit on the wordmark landing
Audio-coupled idea: none
Music: warm bed fading in, low volume
Transition mood: soft → Scene 2

### Scene 2 — The three ways in — 5s
Recreate the onboarding role-select screen on the app bg (`#FFF7F9`): headline "What brings you to Shishi?" settles, then the three real role cards arrive one by one — "Find a Shabbat table" (fork/knife icon), "Host a Shabbat" (home icon), "Sponsor a Shabbat" (heart icon) — each with its actual subcopy, brand-red icon circle, checkmark landing on arrival.
Sequential/interaction: yes — 3 role cards arrive one by one, ~0.6-0.8s apart, each settling with a checkmark
Audio intent: light, deliberate — each card's arrival feels considered, not rapid-fire
Audio-coupled idea: soft interface tick timed to each card's settle (not its slide-in)
Music: warm bed, gently present
Transition mood: soft crossfade → Scene 3

### Scene 3 — Finding a table — 7s
Discover feed: map of Tel Aviv's coastline with pins, dinner cards in the list beside/below it. Jonathan Levi's card is prominent — avatar, "Hosted 6 Shabbats," "Laid-back Shabbat with homemade challah," Friday date, "Kosher," "Free," "3 seats left." A simulated tap/RSVP action, then cut/settle to the dinner detail: green "You're confirmed for this dinner" banner appears, followed by a potluck checklist row ("Bottles of wine — 0 of 2 claimed" / "I'll bring this" button) settling beneath it.
Sequential/interaction: yes — simulated tap on the dinner card → RSVP → confirmation banner appears → potluck row settles in after
Audio intent: the emotional core of the video — the confirm moment should feel like the payoff, warm not triumphant
Audio-coupled idea: warm confirm chime exactly on the "You're confirmed" banner's arrival; potluck row settles with a smaller, quieter tick after
Music: warm bed, slightly fuller under this scene
Transition mood: soft crossfade → Scene 4

### Scene 4 — What makes it possible — 4s
Sponsor donor-feed card (SponsorDinnerCard shape): host avatar, budget-progress bar filling in smoothly from 0, paired with the app's own mission stat appearing beside/beneath it: "~$2B given to Israeli causes from abroad each year." Then cut/crossfade to the closing beat: candlelight gradient returns, wordmark + the hook line settling a second time as the closing statement: "A seat at the table for every Jew who wants one." Hold, then fade to black on the wordmark.
Sequential/interaction: yes — funding bar fills 0→target over ~1s, stat text settles just after
Audio intent: the funding bar fill gets a quiet rising shimmer; the final wordmark hold is where the music settles down, not swells up — no cinematic bombast
Audio-coupled idea: shimmer synced to the funding bar's fill motion, beat-locked to the strong cue at 17.47s (// beat-locked: 17.47s); music volume steps down under the final wordmark hold
Music: warm bed, resolving to a soft fade-out
Transition mood: soft crossfade into the close, then fade to black

**Music mood for this video:** warm, restrained, intimate — a soft companion bed, never the point of the scene
**Audio summary:** The track enters quiet under the hook, stays gentle and present through the role cards and discover flow, gets one warm confirm chime as its emotional peak on the RSVP moment, and fades back down under the closing wordmark — never louder than the story it's supporting.

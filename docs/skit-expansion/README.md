# Additional marsh intermissions

**Current version:** [PR 21 child-focused polish and preview](polish/README.md). The report and frames below describe the initial implementation and are retained as historical evidence. Current scripts, durations, and screenshots are in the polish handoff.

Implements issues #17, #18, and #19, authorized by the owner's request to execute the open skit tasks on 2026-10-04. Uses the proposed placements: The Shortcut after level 6, Do Not Disturb after level 9, Dinner Committee after level 12. Snack Break remains after level 3; no repeats beyond level 12.

The existing scene registry, screen clock, recovery hooks, next-level routing, and gallery support are reused. No caller signature or saved-data format changes: existing Snack Break unlocks are retained, and new scene IDs use the existing validation and unlock paths. The gallery automatically lists the added scenes. Owner correction: removed the obsolete `images/lizard.svg` and its unused asset registration; the skits use the same eight-frame `lizard-walk-side.png` sheet as gameplay, and the configured default image uses `lizard-walk-toward.png`. The hat is aligned to the corrected side-view head. Existing character art plus CSS props suffice; no generated art, new scheduler, audio, or framework escape hatch was needed.

All scenes last 12 seconds, tell their stories with audio muted, and retain the existing Select/Back/Pause/button skip routes. Reduced motion removes Lizard's jump arc/tilt, Spider's vigorous bounce, and the ensemble collision shake while preserving actions and captions. Tongue and hat positions track actual sprite geometry.

## Validation

- `bun run check`: passes; 170 tests, 3,955 assertions, lint, TypeScript, production build. Two existing lint warnings in controllerOwnership.test.ts remain.
- Focused tests cover exact scheduling, lookup identity, saved progress, gag ordering, both plucks, and reduced motion.
- Independent review identified and resolved hat alignment, jump clipping, pluck visibility, diagram direction, and tongue endpoint geometry. Follow-up review found no remaining material issues.
- Scripted browser lifecycle evidence is in [lifecycle-evidence.json](lifecycle-evidence.json): completed levels 3/6/9/12 select the expected scenes and continue to 4/7/10/13. Unscheduled 4/13 continue directly to 5/14. Time and solved totals remain 42/7 during intermissions. Five seconds under recovery retain scene ID and elapsed 4; resuming advances to 4.1.
- Actual preview click on Skip Scene sets elapsed to 12 and reaches playing level 13. Keyboard and physical-controller skip behavior use existing unchanged input handling; they were not tested on physical hardware.
- Screenshots below show the hat, second pluck, and pad catch. At 1280×800, 1280×720, 390×844, and short landscape 844×390, no horizontal overflow occurred and Skip Scene remained within the viewport. The first three sizes have saved screenshots. The earlier local timing recording uses the obsolete Lizard graphic; the updated screenshots below supersede its artwork.
- Browser scenarios were driven through a temporary engine hook and controlled ECS ticks, not manual gameplay. The hook was removed before final checks. No browser-emulated layout establishes real TV, Deck, or phone hardware acceptance.
- Task dev server stopped; port 3000 verified free. Recording stopped and preview navigated away.

## Preview frames

| Scene | Desktop/TV 1280×720 | Deck-sized 1280×800 | Mobile 390×844 |
| --- | --- | --- | --- |
| The Shortcut | [Hat reveal](the-shortcut-1280x720.png) | [Hat reveal](the-shortcut-1280x800.png) | [Hat reveal](the-shortcut-390x844.png) |
| Do Not Disturb | [Second pluck](do-not-disturb-1280x720.png) | [Second pluck](do-not-disturb-1280x800.png) | [Second pluck](do-not-disturb-390x844.png) |
| Dinner Committee | [Pad catch](dinner-committee-1280x720.png) | [Pad catch](dinner-committee-1280x800.png) | [Pad catch](dinner-committee-390x844.png) |

## Owner acceptance

Needs Owner Input: review timing and visual gags before merge, as required by the tickets. The owner requested that PR #21 remain open for closer scene evaluation. Recommendation: retain the proposed 6/9/12 placements and the current pacing; any desired choreography refinement can be made before delivery. The PR is left open pending that creative acceptance even though master requires the CI check containing lint, tests, typechecking, and build.

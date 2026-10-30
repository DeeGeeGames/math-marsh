# Math Marsh: cartoon console presentation

## Purpose and status

Implement a coherent, console-friendly visual system across Math Marsh while retaining its bright cartoon identity, existing gameplay, controls, and saves. This pack records the design discussion and supplies implementation references; it is not an implemented redesign or a release approval.

The owner requested an implementation ticket with all useful assets and HTML. The accepted direction is the bold cartoon world, chunky menu controls, outlined heading signs, responsive phone layouts, and retention of the existing title demonstration. The first realistic sunset/clubhouse treatment was rejected as targeting a different demographic. The first cartoon background was too soft; the supplied stronger palette is the current direction.

**Logo decision:** A, `assets/logos/evolved-wordmark.png`, is the recommended working direction. B is retained for comparison. The owner liked the proposal but did not explicitly choose A over B; confirm the final logo at the first implementation preview before replacing branding globally. Neither generated raster is a production vector master.

Reference code baseline: `21bd9ebeb7fdab91c5a84b58d019c4d010820389` on `master`, verified when preparing this pack. Re-read current source and related issues before implementation.

## Start here

Download/extract the whole folder and open `index.html` directly in a browser. Relative images and fonts are included; there is no CDN, server, build step, or dependency on the originating machine. GitHub displays HTML source; it does not run these previews. Keep the files together.

| File | What it demonstrates | Interaction limits |
| --- | --- | --- |
| `title-and-menus.html` | Animated title, operation selection, settings, final heading treatment | Original title timing and sprite sheets; mock selection/settings, no persistent writes |
| `gameplay.html` | Heading specimens, Expert gameplay layout, pause, results | Static illustrative board; Pause/Resume/Escape demonstrate an overlay only |
| `mobile.html` | Title, math setup, pond setup, settings, gameplay, pause, results in both orientations | Switch screen tabs and phone sizes; sample navigation/settings; game/demo poses are static |
| `logos.html` | A/B/current logo comparison in the animated title layout | Swap artwork while keeping the surrounding scene constant |
| `screenshots/` | Desktop, animation moments, all seven mobile screens at four sizes | Reference captures, not runtime acceptance |
| `screenshots/baseline/` | Actual pre-redesign title, setup, settings | Context only; not the target style |
| `source/titleChoreography.ts`, `source/titleScene.ts` | Exact snapshots of the existing title presentation | Traceability only; integrate with the live source, do not fork these copies |
| `assets/` | Shared background, logo concepts, existing sprites, display font/license | Raw reference assets; optimize appropriate shipping derivatives |
| `manifest.json` | SHA-256, bytes, image dimensions, alpha, file list | Covers this reference pack, not the ZIP container |
| `VALIDATION.md` | Checks and unresolved acceptance | Do not treat prototype checks as product QA |

The four primary HTML files have inline CSS/JS, making spacing, shape, typography, layering, animation mapping, and responsive rules inspectable. Shared assets are externalized to avoid the 10–21 MB embedded-image duplicates used during discussion. Earlier superseded HTML studies are deliberately excluded from the implementation pack.

## Visual system

### Palette and materials

- Dark blue-green ink: `#102b31` (background artwork near-black outlines approximately `#10252b`). Use strong outlines and short solid offsets rather than soft drop shadows alone.
- Warm cream panels: `#fff5cc`; focus/primary golden yellow: `#ffdc61` / `#ffdb57`.
- Grass and pad colors: saturated green around `#75c72b`–`#94da18`, highlights around `#b3ed3c`, deeper green shadows around `#277b24`.
- Board water: `#119daf` to `#086e88`, quieter than the decorative world. Rich cyan/blue surroundings, crisp highlights, no milky mint wash.
- Operation cards retain distinguishable green, cyan, amber, and lilac surfaces, plus symbols, names, and checkmarks. Color alone must not carry meaning.
- Rounded, slightly irregular panel shapes; restrained tilt on signs; thick outlines; simple two/three-tone shading. Preserve the outlined character sprites rather than introducing a different rendering style.
- Put detailed reeds, banks, and scenery outside the active board. Maintain a visible boundary so background lily pads cannot be mistaken for playable cells.

### Type and headings

The font is **Lilita One**, bundled with its SIL Open Font License. Source: https://github.com/google/fonts/tree/main/ofl/lilitaone . Keep the license with distributed font files.

Use it for major headings/signs and selected display numerals, with golden letter faces, dark stroke, a short solid extrusion/shadow, and an opaque cream/green sign. The prototype uses CSS `paint-order: stroke fill` with `-webkit-text-stroke`; ensure the intended rendering across supported browsers/Electron and provide a readable fallback.

Equations, board values, instructions, settings, and secondary copy stay in the established simple, readable UI face. Do not apply decorative logo typography to arithmetic. Layout must allow real names, longer labels, and text zoom; the mockup samples are not maximum lengths.

### Input states

Preserve distinct focused, selected, pressed, disabled, and unavailable/locked states. Focus is a high-contrast outline with a clear active surface; selection persists via checkmarks or an explicit On/Off value when focus moves. Do not copy the prototype's initially yellow row as a permanent second focus state.

Retain actual device-aware input prompts: Xbox, PlayStation, Switch, Steam Deck, keyboard, and touch. Desktop mockups show illustrative Xbox-style A/B labels; do not hardcode those. Mobile layouts use real touch actions rather than controller prompt strips. Fullscreen/Quit must follow platform support and existing availability.

## Screen specification

### Title

Keep the real logo slot, Arcade, Practice, Scenes, How to Play, Settings, player roster access, fullscreen where supported, and native Quit where currently available. Reuse the existing fly answer demonstration, frog/lizard patrols, and spider entrance, including turn and eat sprite sheets, answer consumption, solved highlight, and subsequent equations.

Use `src/ui/titleChoreography.ts` and `src/ui/titleScene.ts` as the owners. Adapt their presentation geometry to the new composition. Preserve existing update/screen lifecycle and reduced-motion behavior; the standalone preview's requestAnimationFrame loop is demonstration scaffolding, not a new app lifecycle or renderer. No learner progress is written by attract mode.

Hide/reduce decorative content on short phones before reducing navigation target sizes. The mobile study hides the demonstration in short portrait and landscape, consistent with the current compact-title approach. Tall portrait shows its intended placement using a fixed demonstration pose.

### Arcade setup

Keep the current two-step flow: choose one or more math operations, then pond difficulty. Desktop uses four operation cards across; portrait uses two by two. Keep operation symbols, names, progress cues, Math steps, optional help, back navigation, and disabled Next/Play rules. The mockups simplify progress to sample captions; preserve the live progression controls, unlocked-step restrictions, progress accessibility, and persistence messaging.

The pond screen uses Easy/Medium/Expert with small/bigger/biggest pond cues, What changes?, and Play. Samples do not change board dimensions or enemy counts: Easy 3×3, Medium 5×4, Expert 6×5 at the reference baseline. Current config remains authoritative. The mobile gallery's Play button shows a fixed Expert example regardless of the illustrated selection; this is explicitly not intended runtime behavior.

### Settings

Large rows with explicit values, comfortable touch targets, and concise relevant help. Preserve current audio/music booleans and touch modes Auto / Always On / Tap lily pads. The mockups have no volume sliders, new saved options, or new audio policy. Maintain current persistence, activation, focus return, and Auto-hide/show-gamepad behavior.

### Gameplay

Retain the board coordinate system, enemy behavior, collision/hit targets, equations, number selection/consumption, timer, progress, and tutorials. The 6×5 Expert sample is the dense layout stress case, not the only board. Keep equation and timer legible above the board, level/context secondary, and Pause accessible. Simple water and outlined pads/numbers support the actual sprites.

The mockup pond is a CSS/SVG illustration. **Do not replace the live canvas/ECS board with this DOM grid or hardcode its numbers, enemy positions, timer, level, or run results.** Integrate the treatment into the existing render paths. Preserve the morning/dusk/night and equation-phase associations in `pondTheme.ts`; only daytime has an approved illustrated reference. Preview corresponding dusk/night styling rather than replacing all phases with the daytime bitmap.

Portrait reserves a thumb region below the board; landscape flanks the board with D-pad/Eat. Preserve direct pond taps and the existing Auto/On/Off behavior, not just the pictured D-pad mode. Board cells may be smaller than 44 px on dense short-phone layouts; the measured 44 px guarantee is for UI buttons, not each board cell. Physical input acceptance is required.

### Pause and results

Pause retains the frozen board behind a subdued scrim, a clear PAUSED sign, Resume, Settings, supported Fullscreen control, and Quit to Menu. Preserve modal focus, restoration, pause clocks, controller recovery, and back behavior.

Results emphasize the existing level reached and equations solved, with Play Again/Main Menu. The samples (Level 3, 18 solved) are illustrative. Preserve demo-completion copy/actions and Practice result semantics. No points, stars, currencies, reward thresholds, or new scoring are proposed.

### Remaining non-game surfaces

Apply shared background, panel, typography, control, and focus tokens to existing Practice, profiles, Scenes/gallery, instructions/onboarding, dialogs/recovery, and demo-end surfaces without changing their product behavior or inventing new information architecture.

The suggested Practice field guide, illustrated story-card collection, and new animated instruction sequences were ideas only and have no approved detailed mockup. Treat them as future design work requiring a separate preview; do not expand this ticket into new learning/progression systems, cutscene animation work, or new audio composition. Preserve branding/splash credits and their current sequence.

## Mobile/TV layout requirements

| Context | Reference size | Expected behavior |
| --- | --- | --- |
| Desktop / TV | 1600×900 captures; validate 1280×720 and 1920×1080 | Controller-first navigation, readable text at TV distance, clear focus; board protected |
| Tall phone portrait | 390×844 | Stacked title, 2×2 operation grid, vertical pond choices, stacked settings, controls below board |
| Small phone portrait | 320×568 | Compact heading/spacing, decorative attract scene omitted, visible essential actions |
| Phone landscape | 844×390 | Title logo/menu split, four operation cards, side-by-side pond choices, board flanked by controls |
| Short landscape | 568×320 | Smaller decoration and margins; essential targets stay ≥44×44 CSS px |

Real safe areas, browser chrome/dynamic viewport changes, orientation changes, touch cancel, text zoom, and longer content must be tested in the actual app. Prototype fixed insets are composition allowances, not verified device safe-area handling. Preserve scrolling where existing longer screens need it; do not compress all content into a fixed viewport just to match a capture.

## Implementation map and boundaries

- Shared theme and controls: `src/ui/styles/theme.css`, `menus.css`, `controls.css`, `prompts.css`, `accessibility.css`.
- Title: `src/ui/titleScene.ts`, `titleChoreography.ts`, `styles/title.css`, `screens/menuScreenSpecs.ts`.
- Setup/progress: `src/ui/modeSelectSetup.ts`, `screens/menuScreenSpecs.ts`, `styles/menus.css`.
- Settings and other menus: `src/ui/screens/settingsScreen.ts`, `playerProfileScreens.ts`, `practiceScreenSpecs.ts`, `skitGalleryScreen.ts`, and their existing styles.
- Gameplay: `src/ui/screens/gameplayScreenSpecs.ts`, `gameplayHud.ts`, `pondSky.ts`, `styles/gameplay.css`, `styles/pond-cycle.css`.
- Actual board render: `src/ecs/systems/RenderSystem.ts`, `systems/render/grid.ts`, `mathProblems.ts`, `objective.ts`, `entities.ts`, and feedback renderers.
- Geometry and input: `src/ecs/boardGeometry.ts`, `src/ui/touchLayout.ts`, `touchInput.ts`, `boardPointer.ts`, `inputPrompts.ts`, `spatialNavigation.ts`.
- Runtime: existing `screenSpecs.ts`, `screenRuntime.ts`, `UIManager.ts`, ECS screen configuration/systems and assets.

Follow current AGENTS.md and the ECSpresso skill. Prefer framework asset, input, screen, and system paths; get approval before adding/expanding an escape hatch and record approved friction as required. No ECS upgrade, save migration, second screen router, imported singleton reach-through, or synthetic input bypass is implied by this visual ticket.

Do not copy prototype routing (`data-go`), sample local toggle state, global event listeners, fixed timers, data URLs, giant embedded assets, gallery resize observers, or independent animation loops into production. Keep the production data model and lifecycle owners.

## Asset preparation

`assets/backgrounds/pond-bold.png` is the final illustrated palette reference, not a requirement to stretch one flattened bitmap across every viewport or every time of day. Match its ink, value contrast, greens, and water. Crop/compose responsively and keep the board quiet. A layered version may be useful for motion, but no new parallax engine or redraw scope was approved.

The generated logos have transparency and are 1448×1086 concept PNGs. Review alpha edges, counters, small-size legibility, and lettering before shipping; create a clean vector/master or suitable optimized derivatives once the final direction is selected. Preserve the original logo until that acceptance. Favicon/PWA/Steam store branding refreshes are not implied by choosing a title-logo study.

Sprites are unmodified copies from the baseline and stay the existing game characters. The copies allow offline reference playback; the implementation should reuse canonical assets rather than duplicate them. Font files retain OFL attribution. `source/asset-origins.json`, logo prompts, and background prompt record provenance. Generated art is not accompanied by a claim of trademark/legal clearance.

## Acceptance checklist

- [ ] Representative title/setup/settings/gameplay/pause/results and mobile implementations match the accepted cartoon direction, with headings readable on all backdrops.
- [ ] Existing title choreography, sheet direction/frame selection, answer consumption and cycle are retained; reduced motion and inactive-screen pause work.
- [ ] No existing actions, progress/help paths, persistence notices, or device-supported controls disappear.
- [ ] Focus, selection, disabled/locked, hover/press, and back/focus restoration remain distinct and functional across input switching.
- [ ] All live game sizes/modes/phases, tutorial flows, demo endings, and result meanings remain correct; no sample data/rules leak into runtime.
- [ ] Touch buttons are ≥44×44 CSS px at reference sizes, remain outside the board, and work through orientation and visibility changes; direct tap mode remains usable.
- [ ] Browser screenshots and interaction evidence cover TV/desktop and all four phone dimensions, including long labels and supported text zoom/safe areas.
- [ ] Font/license and optimized production assets are bundled; no local absolute paths or duplicate reference asset folders enter the shipped runtime.
- [ ] Relevant checks pass (`bun run check`, focused title/controller/profile/practice/UI lifecycle/mobile browser flows). Revalidate after review repairs.
- [ ] Owner reviews the actual desktop/mobile presentation, final logo choice, and corresponding dusk/night treatment; physical controller/TV/touch feel is recorded separately.

## Work order and authorization

One implementation ticket covers this coherent visual pass. First integrate shared tokens/assets/headings and preview title/setup/settings; then adapt board/HUD/overlays and remaining existing surfaces; finish responsive/input/lifecycle validation and final owner review. This sequence is guidance within the ticket, not authorization for new subprojects.

Related issues: #60 (setup semantics), #69 (controller focus), #87/#88 (lifecycle/sprite boundaries), #42 (separate skit-animation work), #92 (separate audio refactor). Re-read live status; do not duplicate their scope or assume this visual pass fixes them.

The current request authorizes the ticket and reference publication only. Product implementation, PR delivery, merges, deployment, and store/Steam asset publication require the applicable separate authorization.

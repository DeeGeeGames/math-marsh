# Controller selection

Math Marsh follows the most recently used controller in menus, profiles, Practice,
tutorials, and gameplay. Steam controller order does not determine the active
controller, and there is no activation button.

- Any newly pressed standard Gamepad button (0–16), including a trigger, selects
  its controller. Native Steam Input uses the actions exposed by the active layout;
  unbound physical buttons are not exposed by that route.
- Either stick selects its controller on crossing the 0.5 action threshold or
  reversing direction. Values are ECSpresso's deadzone-adjusted values. A 0.35
  release threshold prevents jitter near the action threshold from switching back.
- Connection alone, held buttons, and a stationary deflected stick do not repeatedly
  select a controller. If multiple controllers are used within one poll, retain
  the current owner when it participated; otherwise choose the lowest slot.
- The first input performs its ordinary action immediately. An unbound button or
  right stick can select a controller without causing a gameplay action. Normal
  switching does not pause or require returning to neutral.
- Keyboard, pointer, and touch remain usable. Text entry still suppresses keyboard
  navigation/activation bindings. Prompts and audio unlocking use the same
  controller activity signal as selection.

## Framework routing and disconnect recovery

The existing ECSpresso input plugin evaluates per-slot action maps for conventional
and native Steam layouts before the selection system runs. Consumers read the
selected framework player state in the same frame, avoiding deferred rebinding
and stale action edges. Native Steam Skip and Pause remain separate actions.
No custom polling, synthetic input, or new framework escape hatch was added.

Selection tracks slot plus observed device ID. An observed active-controller
disconnect or replacement still freezes gameplay and clocks immediately and opens
the recovery screen. Use any controller button or stick, release all controls,
then choose Continue. Acquisition cannot resume the run accidentally. Keyboard and
touch can also continue. Screen-stack recovery preserves tutorial, pause, settings,
and celebration state.

## Validation and reproduction

Verified for this change: `bun run check` (548 tests, lint, TypeScript, web build),
`bun run desktop:check`, and 10 focused Playwright controller/selection journeys.
Independent review findings were repaired and the affected behavior rechecked.

`src/ecs/controllerOwnership.test.ts` exercises the real input plugin and selection
system, including first-input routing, second-slot takeover, identical model IDs,
held-input isolation, axis direction changes, all standard buttons, keyboard/text
entry, diagnostics, and disconnect/reconnect suppression.
`src/platform/steamInput.test.ts` covers native action routing and provider identity.

`e2e/controllerFocus.pw.ts` uses simulated controllers in Chromium. Its switching
journey covers second-controller D-pad navigation, updated glyphs, first-press
tutorial progression, keyboard-to-controller prompt restoration on stick reversal,
and first-press pause from the second controller during gameplay. Existing journeys
cover focus, Practice, and disconnect recovery. Run:

```sh
bun run check
bunx playwright test e2e/controllerFocus.pw.ts e2e/partialSelection.pw.ts
```

The supplementary fixture can be started with
`bun --port 3001 scripts/controller-selection-browser-fixture.html` at
`http://localhost:3001/?fresh`, then run
`window.__controllerFixture.runJourney()`. `fresh` clears onboarding records only
on that test origin; `timerFrames` supplies a fixture-only animation clock.

The JSON files in this directory record the older, explicit A/Start ownership
policy. They remain historical evidence and do not validate the current switching
policy. Current browser results are recorded by Playwright.

## Hardware validation still required

Simulated input does not prove physical Steam Deck handheld/docked switching,
Steam Input layouts, packaged builds, or TV-distance readability. Validate the
exact Steam build with the built-in Deck controller still connected and an external
controller in the second position, both before launch and hot-plugged during play.
Test both directions of switching, remapped layouts, and disconnect recovery.

ECSpresso 0.22 exposes four slots and no button-count or connection-token API.
Selection observes standard buttons and four stick axes. Same-slot/same-ID
replacement or reorder wholly between polls is unobservable. Steam/browser/SDL
routing must expose a controller before application selection can use it.

## Prompt families and focus (#69 / #70)

Settings has a controller-navigable **Button prompts** cycle button: Auto, Xbox,
PlayStation, Nintendo, Steam Deck. The choice persists locally and applies to
conventional controllers across menus, gameplay and recovery. Auto uses the active
owner's observed device ID; Steam emulation can mask that identity. Choose a family
explicitly in that case. This changes artwork, not controls: conventional standard
mapping remains bottom face button for Select/Eat, right face button for Back and
Start/Options/Plus for Pause/Skip (Nintendo B selects, A goes back).

Existing native Steam action-origin glyphs and labels take priority over this
artwork preference, including remapped or unbound actions. This work does not add
native action routing or infer physical identity from browser slot numbers.
Valve documents native-handle/XInput association for emulated controllers, which
cannot safely be inferred from Chromium's Gamepad index. A new native emulation
bridge was therefore deferred in favor of the explicit family fallback:

- [Steam Input emulation guidance](https://partner.steamgames.com/doc/features/steam_controller/steam_input_gamepad_emulation_bestpractices)
- [ISteamInput action-origin and glyph APIs](https://partner.steamgames.com/doc/api/ISteamInput)

The fallback is not binding-aware. Custom Steam legacy remaps cannot be represented
by selecting an artwork family. Native origins use the existing provider's actual
action data, but physical remapping accuracy still requires Steam-launched checks.

Automated evidence: `e2e/controllerFocus.pw.ts` exercises mouse/touch-to-controller
rendered focus, stick/D-pad navigation, restored and keyboard focus; masked Xbox
IDs with a saved PlayStation fallback; controller-only selection; reconnecting a
Nintendo replacement; Auto detection; and matching glyph alt text in Settings,
tutorial, gameplay, pause and recovery. Screenshots cover 1920×1080 TV, 1280×800 Deck and 390×844
mobile prompt Settings; the focus journey also covers 1280×720. These are Chromium
simulations, not physical TV-distance or controller acceptance. The shared native
origin renderer and prompt state transitions also have Bun regression coverage.

Unavailable here: packaged Steam-launched Xbox, PlayStation, Nintendo-compatible
and Steam Deck checks with Steam Input enabled/disabled and remapped layouts.
These remain owner/device acceptance gates; no Steam settings were published.

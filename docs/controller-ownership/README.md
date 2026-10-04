# Controller ownership — issue #13

The owner approved this policy on 2026-10-04: A or Start claims an unowned
controller; connected nonowners cannot take over; an observed owner disconnect
freezes the run; acquisition controls must be released before deliberate
continuation. Existing keyboard, pointer, and touch controls remain usable.
No existing public input bindings or stored settings were removed.

## Implementation

- `controllerSelection` records the controller slot and observed ID, plus neutral
  acquisition and transition-frame suppression. Simultaneous claims choose the
  lowest slot. Connection and stick activity alone cannot claim ownership.
- ECSpresso input action maps route buttons and axes to the owner. An isolated
  keyboard action map preserves keyboard edges during deferred rebinding.
- A recovery screen preserves the ECS screen stack. Clock and gameplay groups
  freeze immediately on disconnect, before asynchronous screen entry. Continuing
  restores the prior tutorial, playing, pause, settings, or celebration screen.
- Settings UI/focus restore on resume. Level completion preserves its remaining
  celebration duration. Only owner activity selects controller glyphs; keyboard
  and pointer activity can switch prompts during acquisition.
- Production uses ECSpresso input, resources, system groups, and screen lifecycle
  APIs. No new framework escape hatch was needed.

## Validation

`bun run check` passes: lint, 159 tests, TypeScript, and web build.
`bun run desktop:check` passes: TypeScript and desktop production build.
Independent review found no remaining material defects. `git diff --check` passes.

The T3 collaborative browser journey at 1280×800 passed:

1. Idle/drifting controller ignored; slot 1 A claim consumed with held controls.
2. Other-controller buttons, sticks, and PlayStation ID cannot steal control or
   change the owner's Xbox glyphs.
3. Controller-only mode selection → tutorial → gameplay → pause/settings →
   results → retry → quit-to-menu → desktop quit mock.
4. Real recovery screen exit/resume for tutorial, playing, paused, settings, and
   level completion. Clocks and run time remain frozen; acquisition cannot resume
   or advance the tutorial; a held axis must return to neutral.
5. A dedicated celebration-state fixture remains paused beyond its normal
   1.6-second duration and restores the remaining celebration on continuation.
6. Results use normal gameplay-time and death-delay systems after the fixture
   expires the run. Retry resets totals.

`browser-evidence.json` captures this journey. `startup-evidence.json` separately
records slot 1 claim on the studio splash, engine splash, and menu.
`compatibility-evidence.json` records synthetic keyboard/pointer/touch DOM journeys
and keyboard/touch continuation without a replacement controller. Keyboard
activation/back and glyph persistence were also checked during a held claim.

The recovery panel was measured at 1280×800: 576×484, inside the viewport;
36px heading, 20px body text, and a 524×60 Continue button. This is DOM geometry
and behavior evidence. T3 snapshot/save calls failed and resize timed out, so no
rendered screenshot or additional viewport acceptance is claimed.

## Reproduce the browser journey

Run `bun --port 3001 scripts/controller-selection-browser-fixture.html`, then open
`http://localhost:3001/?fresh`. The `fresh` flag resets only onboarding records on
this test origin. For preview clients without animation frames, add `timerFrames`.
The production entrypoint retains native requestAnimationFrame.

Start `window.__controllerFixture.runJourney().then(result => {
window.__controllerJourneyResult = result; })`, then inspect
`window.__controllerJourneyResult`. The journey returns assertions and observations.
Use `?timerFrames&fresh&startupClaim` to seed a held slot 1 claim before boot.

## Remaining device validation and API limits

- Gamepad polling and desktop quit are simulated. Physical controllers, Steam
  Input, packaged app controller behavior, Deck handheld/docked switching, and TV
  distance/overscan have not been tested. Desktop build success is not device proof.
- ECSpresso 0.22.0 exposes four controller slots. Equal device IDs remain distinct
  by slot. A same-slot/same-ID replacement or reorder wholly between polls is
  unobservable; it cannot be reliably identified through this API. Observed slot
  disappearance or ID change triggers recovery and requires a deliberate claim.
- Screenshot and alternate viewport verification remain unavailable in this T3
  preview. Hardware validation should include the recovery panel's readability.

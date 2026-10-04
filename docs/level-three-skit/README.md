# Level-three skit: Snack Break

Status: owner accepted the skit and authorized normal delivery; final trigger is after level three.

The level-three completion celebration now leads into a 12-second intermission:
Frog attempts to catch Fly, Fly dodges, Frog reels in a lily pad and complains
about salad, and Fly escapes with a math-themed punchline. The run then resumes
at level four through the existing next-level flow.

Scope: one skit, after level three on each run. No persistent state changes or
new art. Future cadence is isolated in `src/ecs/skitSequence.ts`;
`shouldPlaySkit` currently returns true only for completed level three.

The ECSpresso skit screen owns elapsed time and transitions. Gameplay clocks
stay paused. Controller recovery suspends the skit and resumes its elapsed time.
Existing screen presentation and sprite sheets provide the DOM animation.
Select (Enter/Space or controller primary button), Back/Pause, or the Skip Skit
button skip to the same next-level path. Reduced motion disables flutter and
shaking while preserving the story.

## Validation

- `bun run check` passed: lint, 162 tests, TypeScript, production build.
  Two pre-existing lint warnings remain in controllerOwnership.test.ts.
- Independent code review found no material lifecycle or gameplay issue.
  Corrected sprite aspect ratios and replaced the duplicated duration literal.
- Browser: forced level-one clear through the existing equation-mode resource,
  observed celebration -> skit -> playing level two; time stayed 89.984 seconds
  during the intermission. This validates the transition, not manual gameplay.
- Browser: invoking the wired Skip Skit button callback advanced to level two.
  Tool-generated short key/click interactions did not reliably reach a game
  frame, so physical keyboard/controller acceptance remains for owner review.
- Browser: pushed controller recovery at skit elapsed 4; updating five seconds
  under recovery left elapsed 4. After resume, a 0.1-second tick advanced to 4.1;
  remaining run time stayed 90 seconds.
- Viewed 1280x800 and 390x844 layouts; measured 844x390 layout without page overflow
  and with the skip button within the viewport. Corrected fly clipping after
  the first recording. Final production assets include this correction.
- A temporary engine hook used for browser validation was removed from main.ts.
  The dev server was stopped and port 3000 verified free.
- The earlier disconnected recording was recovered and stopped during delivery.
  Preview tab tab_1 was navigated to about:blank and its recording stopped.
  The dev server is stopped and port 3000 is free.
- Final-trigger browser checks: completed level three -> skit -> level four,
  retaining 42 seconds and 7 equations solved. Levels one, two, and four went
  directly to levels two, three, and five without a skit. These transitions were
  driven through equation-mode resources and ECS ticks rather than manual play.

## Owner acceptance

Owner accepted the skit preview and requested that it play after level three.
The behavior is otherwise unchanged; this does not schedule repeats every three
levels. Run `bun run dev` and complete level three to see the final trigger.

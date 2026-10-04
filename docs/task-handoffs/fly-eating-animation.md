# Fly eating animation

Correct equation completion starts one 720 ms eating sequence, matching answer consumption. Partial selections and incorrect answers retain their existing feedback. Eating takes presentation ownership from a turn, keeps the current logical facing, and returns to flight afterward. Movement and game rules are unchanged.

Assets: `src/assets/images/fly-eat-{toward,side,away}.png`, eight 256 px square cells per horizontal strip. Left uses the mirrored side strip. Assets use the existing eager ECSpresso image registry and shared sprite animation playback.

Validation: `bun run check` passed (172 tests, lint, typecheck, build; two pre-existing lint warnings in controllerOwnership.test.ts). Independent review found no material defect. The small ECS test covers all facings, mirroring, turn interruption, midpoint playback, completion, and return to flight. T3 browser probe invoked the real selection handler on an initialized game and confirmed partial/incorrect selections do not eat, correct completion consumes the answer and starts a 0.72-second animation. A frozen chewing frame was inspected in the game renderer; this was controlled browser evidence, not a controller/device playtest. Temporary hooks were removed and the dev server stopped.

Artwork used the built-in image generation tool with the existing front, side, and rear flight sheets as identity references. Final prompt set:

1. Create an eating/chewing sprite atlas for the exact reference fly, 8 columns and 3 rows of equally sized square cells; front, right-facing side, and rear rows. Frames: neutral, mouth opening/head dipping with forelegs raised, bite, closed-mouth chew, second open-mouth chew, swallow, satisfied blink, neutral. Rear conveys chewing through forelegs and slight head/body motion without a visible face. Preserve character identity, blue-gray colors, eyes, silhouette, thick 2D outlines, scale, center, and foot baseline. Gentle wing flutter, transparent background and gutters, no food, props, labels, grid, or external shadows.
2. Remove only the background and external glow/shadow; preserve all 24 sprites, their 8-by-3 grid, colors, wings, faces, poses, and locations. Deliver true transparent alpha without an opaque backdrop or drawn checkerboard.

Deterministic ImageMagick preparation split the grid, trimmed bounds at alpha above 12%, scaled each row uniformly to a maximum visible height of 225 px, and bottom-centered frames in 256 px cells. Geometry tests cover all new sheets. Original artwork was preserved.

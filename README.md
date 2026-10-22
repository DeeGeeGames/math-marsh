# Math Marsh

Math Marsh is an arithmetic game built with TypeScript, Bun, and [ECSpresso](https://github.com/pedronasser/ecspresso). Guide a fly across a pond of numbered lily pads, solve equations, and avoid enemies before the timer runs out. It runs in a browser and has an Electron desktop build.

## Run locally

Install [Bun](https://bun.sh/), then run:

```bash
bun install
bun run dev
```

Open the local address printed by Bun. The main menu has a **How to Play** guide. Choose one or more operations and a difficulty to start a run; the game offers a short tutorial on first play.

## Play

- Move with the arrow keys, WASD, gamepad D-pad or left stick, or the optional on-screen D-pad.
- Eat a number with Space, Enter, the gamepad's primary button, or the on-screen Eat button. On a touch or pointer device, select a lily pad to move there, then select the fly to eat the number.
- Use Escape or the gamepad Start button to pause. F1 opens settings. Settings include sound effects, background music, and the on-screen controls mode.
- Easy, Medium, and Expert select the arcade challenge: 3×3, 5×4, and 6×5 boards with one, three, and four enemies respectively. Enemy types vary between boards; their count and movement cadence stay steady within a difficulty. Scripted tutorials use a 6×5 board.
- Levels normally require clearing two thirds of the board. Larger enemy rosters lower that target to leave one pad per enemy, plus one extra for two-number answers.
- Correct answers add time; wrong answers and enemy hits cost time. Saved math progress determines number ranges at board spawn, with separate tracks for each selected operation. These ranges stay fixed until the next board. Easy uses answer questions only; Medium alternates answer and operand questions by level; Expert cycles through answer, operand, and mixed-blank questions by level.
- After six correct equations in a skill, accurate play advances one step; fast, accurate rounds advance two steps, then up to four during a streak. Mixed-operation runs keep samples separate. Timing excludes pauses, tutorials, skits, and board celebrations. Skill advancement applies on the next board without changing the current equation format or ending the board early.
- Setup shows your current skill and unlocked steps. Earlier/Later controls let you revisit unlocked work without losing rewards. Progress is stored on this device; the game reports when only session storage is available. Existing Practice-mode saves are retained.

Gamepad actions currently use the controller reported in slot 0. Controller selection and reconnect handling are still being developed.

## Develop

| Command | Purpose |
| --- | --- |
| `bun run dev:assets` | Open the standalone character animation and audio preview on port 3001 |
| `bun run check` | Lint, unit tests, typecheck, and browser build |
| `bun run test:e2e` | Playwright browser tests |
| `bun run build` | Build the browser app into `dist/` |
| `bun run preview` | Serve the production browser build |
| `bun run desktop:dev` | Run the Electron shell with the development server |
| `bun run desktop:check` | Typecheck and build the Electron renderer |
| `bun run desktop:package:linux` / `bun run desktop:package:win` | Package desktop builds for the named platform |

Run `bun run dev:assets` and open `http://localhost:3001`. Select Fly, Frog, Lizard, or Spider, then an animation. Play it on a loop, step forward or backward, or scrub to a frame; stepping pauses playback. The inspector also supports speed, mirroring, reverse playback, and contrasting backdrops. Music and sound effect buttons use the game’s audio synthesis, including the low-time warning. Stop all audio silences playback; saved game audio settings are unchanged. This entry point is excluded from production and desktop builds.

Choose **Open music timeline mixer** to explore layers over the persistent gameplay background at `/music-options.html`. **Saved mix · 5 sections** restores the arrangement used by gameplay; browser drafts resume automatically. Edit patterns, levels, and section order, audition the build-up or loop seam, and copy the arrangement as plain text. See the [mixer notes](src/dev/music-options/README.md) for timing and implementation details. Mixer edits affect only the development preview.

The main entry points are `src/main.ts` and `src/ecs/bootstrap.ts`. `src/ecs/Engine.ts` configures ECSpresso screens, input, resources, and plugins; `src/ecs/gameplayPlugin.ts` groups gameplay systems. `src/ui/screens/` defines DOM screens, and `src/ecs/systems/RenderSystem.ts` draws the Canvas board. Game balance lives mainly in `src/config.ts`, `src/ecs/systemConfigs.ts`, and `src/math/equations.ts`. Read [AGENTS.md](AGENTS.md) before changing ECS or input behavior.

The browser build defaults to the `/math-marsh/` base path. Set `BASE_PATH` when deploying under another path, for example `BASE_PATH=/my-game/ bun run build`. A push to `master` runs the GitHub Pages workflow; Steam packaging and deployment use separate workflows.

The production browser build is installable as a progressive web app on supported mobile and desktop browsers. Open it once while online and allow the page to finish loading; the service worker then stores the game shell and bundled assets for offline launches. New builds are cached in the background and take effect after all open game tabs are closed. Offline installation requires HTTPS or localhost; `bun run dev` does not provide the production service worker. Use `bun run build && bun run preview` to test the installed build locally.

### Native Steam Input

Steam-launched desktop builds use named Menu/Gameplay actions through `steamworks-ffi-node` 0.11.3 and SDL 2.32.8 (`@kmamal/sdl` 0.11.13). SDL's Steam controller handle identifies emulated copies for per-device suppression; unrelated conventional controllers remain available. Native actions enter ECSpresso through its public gamepad polling hook, preserving ownership, neutral handoff, action edges, and navigation repeats. Native Skip and Pause are separate bindable actions. Prompts use the current action origins, including rebinding changes, with accessible labels when a glyph is unavailable.

Direct standalone launches retain browser Gamepad input and never initialize Steamworks. The web bundle imports neither native library. Steam/SDL initialization or sampling failure falls back to browser controllers; provider identity changes use the existing controller recovery flow. Native input is suppressed while the Electron window is unfocused and until held controls return to neutral.

Desktop packaging requires the approved SDK 1.64 redistributables archive; the full SDK stays outside Git. CI downloads `s3://steam-resources/steamworks_sdk.tar.gz` through the repository-specific `GitHubActions-MathMarsh-SteamSDK` OIDC role, which can read only that object. `scripts/prepare-steam-sdk.ts` pins the archive SHA-256 and both shipped libraries. For an authorized local build:

```sh
aws s3 cp s3://steam-resources/steamworks_sdk.tar.gz /tmp/math-marsh-steamworks_sdk.tar.gz
bun scripts/prepare-steam-sdk.ts /tmp/math-marsh-steamworks_sdk.tar.gz
bun run desktop:package:linux # use desktop:package:win on a Windows host
```

The native FFI modules, SDL binaries, SDK redistributables, action manifest, and default layout ship outside ASAR. Build each platform on its own host so SDL's native library matches the target. The native launch guard requires Math Marsh's Steam app ID (`4927380`) in the Steam launch environment; it never restarts the app through Steam. Local source launches can set `MATH_MARSH_STEAM_SDK_ROOT` to an extracted SDK directory.

The bundled manifest is `resources/steam-input/game_actions.vdf`. Keep the existing Generic Gamepad Steam default for conventional builds during rollout. Publish compatible native configuration only with a gameplay build that consumes this manifest, and verify Linux/Steam Deck and Windows, controller families, remapped layouts, D-pad versus stick, and disconnect/reconnect before shipping native defaults. Unit tests and browser simulations do not establish that hardware acceptance.

Steam Cloud saves use an account-scoped portable file with Steam Auto-Cloud. See [setup, migration, and acceptance checks](docs/steam-cloud.md); Steamworks configuration and a two-device Steam test are required before public enablement.

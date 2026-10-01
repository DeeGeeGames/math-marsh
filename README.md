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
- Correct answers add time; wrong answers and enemy hits cost time. Levels cycle through finding the result, both operands, then one operand and the result. Number ranges increase after each three-level cycle.

Gamepad actions currently use the controller reported in slot 0. Controller selection and reconnect handling are still being developed.

## Develop

| Command | Purpose |
| --- | --- |
| `bun run check` | Lint, unit tests, typecheck, and browser build |
| `bun run test:e2e` | Playwright browser tests |
| `bun run build` | Build the browser app into `dist/` |
| `bun run preview` | Serve the production browser build |
| `bun run desktop:dev` | Run the Electron shell with the development server |
| `bun run desktop:check` | Typecheck and build the Electron renderer |
| `bun run desktop:package:linux` / `bun run desktop:package:win` | Package desktop builds for the named platform |

The main entry points are `src/main.ts` and `src/ecs/bootstrap.ts`. `src/ecs/Engine.ts` configures ECSpresso screens, input, resources, and plugins; `src/ecs/gameplayPlugin.ts` groups gameplay systems. `src/ui/screens/` defines DOM screens, and `src/ecs/systems/RenderSystem.ts` draws the Canvas board. Game balance lives mainly in `src/config.ts`, `src/ecs/systemConfigs.ts`, and `src/math/equations.ts`. Read [AGENTS.md](AGENTS.md) before changing ECS or input behavior.

The browser build defaults to the `/math-marsh/` base path. Set `BASE_PATH` when deploying under another path, for example `BASE_PATH=/my-game/ bun run build`. A push to `master` runs the GitHub Pages workflow; Steam packaging and deployment use separate workflows.

The production browser build is installable as a progressive web app on supported mobile and desktop browsers. Open it once while online and allow the page to finish loading; the service worker then stores the game shell and bundled assets for offline launches. New builds are cached in the background and take effect after all open game tabs are closed. Offline installation requires HTTPS or localhost; `bun run dev` does not provide the production service worker. Use `bun run build && bun run preview` to test the installed build locally.

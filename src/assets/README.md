# Runtime assets

- `sprites/{fly,frog,lizard,spider}/`: character animation sheets and static images still used by gameplay or cutscenes.
- `icons/`: favicons, touch/PWA icons, and the desktop app icon.
- `button-prompts/`: keyboard and controller glyphs used by the UI.
- `brand/`: splash logos and their provenance/license information.

Register character assets in `src/ecs/assets.ts`; `bun run dev:assets` previews that same registry. `spriteSheets.test.ts` checks runtime sheet geometry. Away-facing fly eating intentionally reuses `fly-move-away.png`.

Keep design references and spare glyphs in [`art/reference`](../../art/reference/README.md), outside the source tree. Add only assets with runtime callers here, and update web, PWA, and desktop paths when moving icons.

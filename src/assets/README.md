# Runtime assets

- `sprites/{fly,frog,lizard,spider}/`: character animation sheets and static images still used by gameplay or cutscenes.
- `icons/`: favicons, touch/PWA icons, and the desktop app icon.
- `button-prompts/`: keyboard and controller glyphs used by the UI.
- `brand/`: splash logos and their provenance/license information.
- `ui/cartoon-pond.webp`: optimized derivative of the approved issue #133 reference backdrop, pinned at `4ca9a7406244284b9ffe1c068e3266d8d447dc95:docs/design/cartoon-console-ui/assets/backgrounds/pond-bold.png`. Menus use the daytime artwork; gameplay combines it with the existing phase-aware sky and corresponding dusk/night tints outside the canvas.
- `ui/title-wordmark.webp`: lossless optimized copy of logo A (`assets/logos/evolved-wordmark.png`) from that reference pack, used for the implementation preview. The owner selected A for the preview; actual presentation review remains pending. The existing canonical brand, icon, PWA and Steam artwork are preserved.
- `fonts/`: locally bundled Lilita One display lettering from the same reference pack, with its SIL Open Font License. The build includes `LilitaOne-OFL.txt`; equations and body copy retain the simple UI font.

Register character assets in `src/ecs/assets.ts`; `bun run dev:assets` previews that same registry. `spriteSheets.test.ts` checks runtime sheet geometry. Away-facing fly eating intentionally reuses `fly-move-away.png`.

Keep design references and spare glyphs in [`art/reference`](../../art/reference/README.md), outside the source tree. Add only assets with runtime callers here, and update web, PWA, and desktop paths when moving icons.

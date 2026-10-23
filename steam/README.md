# Steam assets

- [store](store/): Math Marsh store and library upload files, app `4927380`.
- [store-demo](store-demo/): Math Marsh Demo store and library upload files, app `5493870`.
- [input](input/): Steam Input action manifest and default controller configuration.
- `install_script_linux.vdf`: Linux depot installation script.

The store folders archive the corrected artwork saved to Steamworks on 2026-10-23. Each contains the eight corrected character-art exports and its app's retained transparent Library Logo. The demo uses the same eight upload images as the full game; its Library Logo includes “Demo”. Steam adds the green demo corner treatment to the applicable capsule images, so that treatment is deliberately absent from these upload sources.

| File in each store folder | Steamworks slot | Pixels |
| --- | --- | --- |
| `header-capsule.png` | Header Capsule | 920 × 430 |
| `small-capsule.png` | Small Capsule | 462 × 174 |
| `main-capsule.png` | Main Capsule | 1232 × 706 |
| `vertical-capsule.png` | Vertical Capsule | 748 × 896 |
| `page-background.png` | Page Background | 1438 × 810 |
| `library-capsule.png` | Library Capsule | 600 × 900 |
| `library-header.png` | Library Header | 920 × 430 |
| `library-hero.png` | Library Hero | 3840 × 1240 |
| `library-logo.png` | Library Logo | 1280 × 720 |

Each folder's `assets.json` records the app ID, dimensions, SHA-256 checksums, original filenames, image-editing instructions, and saved Steamworks asset URLs. The URLs identify the saved versions verified during that artwork replacement; they are provenance, not a statement of current publication or review status. Steam may resize, recompress, or add demo treatment to its saved copies.

These are marketing upload files. Browser and desktop builds use the runtime assets under `src/assets`; the demo completion screen still uses `src/assets/brand/math-marsh-banner.png`. Packaging includes only `steam/input` from this directory as a resource. The store images are not gameplay screenshots and are not bundled with the game.

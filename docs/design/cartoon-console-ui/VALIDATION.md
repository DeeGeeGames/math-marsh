# Reference validation

## Checked when packaging

- Reference baseline and fetched `origin/master`: `21bd9ebeb7fdab91c5a84b58d019c4d010820389`.
- Opened the index and all four primary HTML files from an independently copied temporary folder using Chromium, with HTTP/HTTPS requests blocked.
- Image resources and local Lilita One font load without the original worktree, generated-image folder, or a server. No absolute machine paths remain in the packaged HTML.
- No page errors, resource request failures, or external resource requests in that portability check.
- Title's original choreography presents `6 + 2 = 8 ✓` and consumes the answer. During the design pass, next-equation cycling, spider entrance, live animation advancement, and reduced-motion pause were also checked.
- Gameplay study Pause/Escape and logo comparison work. They are demonstration interactions, not real game sessions.
- All seven mobile studies were checked at 390×844, 320×568, 844×390, and 568×320: 28 layouts. Measured buttons/headings/boards/dialogs fit inside their device frames; visible UI button boxes meet 44×44 CSS px. This does not guarantee every board cell is 44 px, all text fits every translation, or that targets remain comfortable under physical browser chrome.
- `bun run typecheck` passes in the unchanged application checkout. No application behavior was changed or implemented by packaging these references.
- Generated logo PNGs are RGBA with alpha spanning 0–255; this confirms transparency exists, not production-quality edge cleanup.

## Not established

- Production rendering/input/lifecycle performance or regressions.
- Physical phone safe-area/browser chrome behavior, touch precision, landscape ergonomics, or controller/TV-distance readability.
- Final approval of logo A versus B, production typography/asset cleanup, or corresponding dusk/night presentation.
- Final visual treatment for non-mocked existing menus or acceptance of additional field-guide/story-card/instruction-animation ideas.
- True multi-screen routing, save writes, enabled/disabled selection logic, game outcomes, or accessibility conformance in the reference HTML.

During implementation, run the repository's real checks and interaction journeys. Inspect focus after input-device switching, pause/resume, transitions, resize/orientation changes, cancellation, visibility loss, profile/persistence states, real dense boards, and text scaling. Keep physical hardware and owner visual acceptance distinct from browser evidence.

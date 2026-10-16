# Music timeline mixer

Run `bun run dev:assets`, then choose **Open music timeline mixer** from Audio audition. The same server exposes `/music-options.html`; there is no generated-file prerequisite. Navigation between the asset inspector and mixer stays in one tab, so each page's existing `pagehide` cleanup stops its audio.

The owner's selected arrangement is preserved verbatim in [saved-arrangement.ts](saved-arrangement.ts) and integrated into gameplay through `src/audio/musicScore.ts`. Fresh mixer sessions start there; **Saved mix · 5 sections → Load preset** restores it even after loading or editing a browser draft. Copy arrangement and Load pasted arrangement exchange readable text, without a file. Local drafts use `math-marsh-music-mixer-v1`, separate from game settings and learner data; editing a draft does not change production music.

## Selected arrangement

The original background plays throughout. At normal tempo, each step is 430 ms and each section spans 16 steps / two original cycles / 6.88 seconds. The opening plays once, followed by this repeating five-section body:

| First-pass time | Section | Added layers, all at 100% |
| --- | --- | --- |
| 0–6.88s | Opening | None |
| 6.88–13.76s | 1 | Pulse & shaker A |
| 13.76–20.64s | 2 | Pulse & shaker A; Offbeat chords A |
| 20.64–27.52s | 3 | Pulse & shaker A; Offbeat chords A; Gentle chords A; Wooden plucks A |
| 27.52–34.40s | 4 | Gentle chords A; Wooden plucks A |
| 34.40–41.28s | 5 | Gentle chords A |

At 41.28s, the 34.40-second body returns to section 1. The bare opening is not repeated. All other added layers remain off. Check loop seam specifically auditions the transition from gentle chords back to pulse & shaker.

## Implementation and refinement

- `src/audio/musicScore.ts` owns the shared background, candidate notes, and selected five-section gameplay score. The preview's `score.ts` renders those notes offline. `mixer.ts` extracts their added layers into deduplicated 16-step phrases, relocates selected phrases, and adds the original background exactly once. Moving a late phrase earlier does not retain its original entry gate. Whole sections keep the bass/harmony phase aligned.
- `playback.ts` renders an opening and a cyclic body through Web Audio. Rendering two body cycles and taking the second preserves note/filter tails at the wrap. Two buffer sources meet at a sample-aligned opening/body boundary; edits stop playback and invalidate pending renders. Gain nodes start quiet before future envelope events to avoid first-sample transients.
- The 1.2× tempo preview scales beat/note durations while preserving the original percussion's fixed length. It does not exercise the actual game's low-time warning or threshold crossing. Production audio remains owned by `src/audio/audio.ts`: it schedules the shared score using its existing adaptive beat timer, warning bridge, mute, scene switching, and cleanup. It never imports the mixer UI, text parser, or offline renderer.
- The preview uses seeded percussion for reproducible comparisons; gameplay keeps its existing random noise synthesis. Layer levels are relative percentages, while listening volume is excluded from shared text. The runtime and saved recipe are compared note for note across three loops in `src/audio/musicScore.test.ts`.
- Treat the `Math Marsh mix v1` header, row names, pattern IDs, and timing as a shareable format. Keep them stable for saved/copied arrangements, or explicitly version and migrate changes. `parseMixText` validates inputs before loading and rejects missing/unknown rows, unsupported patterns, invalid levels, or disabling the background.
- `mixer.test.ts` covers source-preset fidelity, relocation, reordering, baseline persistence, and text restoration. `saved-arrangement.test.ts` locks the selected five-section recipe and its layer schedule. Audio sample checks and browser controls validate mechanics; headphones/speakers, physical controller input, and listening preference remain separate acceptance checks.

Related exploration ticket: [GitHub Project item 274142826](https://github.com/users/david0178418/projects/2/views/1?layout_template=board&pane=issue&itemId=274142826). These notes live with the code so they remain available even when Project draft access is unavailable.

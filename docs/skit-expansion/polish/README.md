# PR 21: skit polish and owner preview

The owner requested an evaluation of PR 21's writing and implementation, a polish pass for children, and a preview before merging. This changes the presentation and scripts of the existing scenes. PR 21 must stay open pending the owner's creative review.

## Evaluation and changes

The original scripts rushed several captions, used adult idioms ("carry the lizard", "zero coordination"), and relied on narration to explain actions. Characters sometimes snapped into place, faced away from conversations, or remained piled together after the collision.

- **The Shortcut:** Lizard announces a BIG jump, splashes down, and proudly becomes "a lily pad with toes". Smooth crossing/jump/appearance, water splash, and a visible hat reveal give the physical joke room to land.
- **Do Not Disturb:** Fly discovers a tiny harp. Spider enjoys the wiggles and asks for another pluck, ending with a bouncy lullaby. A gentler, decaying web wobble and musical lettering carry the gag without sound.
- **Dinner Committee:** "Meet in the middle!" leads to an overenthusiastic collision. The characters separate, Frog fetches a leaf, and Fly proposes a salad picnic. The original rotating-map trick was removed because rotating its symmetric arrows did not explain the inward charge. The inward arrows now agree with the dialogue and movement.
- Each new scene lasts 16 seconds, with five captions held for at least two seconds each and at least four seconds for the final line. Snack Break remains 12 seconds; its closing line is now "One extra-green lunch!"
- Brighter pond staging, a consistent caption panel, named speakers, animated wings, conversational facing, and clearer prop placement work across desktop and phone layouts. Reduced motion removes flutter, bounce, and shaking while retaining story beats.

The existing scene IDs, unlock storage, schedule at levels 3/6/9/12, gallery, skip routes, ECSpresso screen clock, and recovery lifecycle remain in use. No new framework escape hatch, runtime dependency, generated character artwork, or audio was added. Internal presentation poses gained frame/facing/prop fields; no public API or saved-data format changed.

## Preview

[Watch all three scenes](preview.mp4) — approximately 49 seconds. Recorded from the actual gallery replay flow in the T3 collaborative browser at 1280×720. Only idle gallery footage was trimmed; scene timing is unchanged. Audio is not required or added.

| Scene | Desktop/TV layout | Phone layout |
| --- | --- | --- |
| The Shortcut | [1280×720](the-shortcut-1280x720.png) | [390×844](the-shortcut-390x844.png) |
| Do Not Disturb | [1280×720](do-not-disturb-1280x720.png) | [390×844](do-not-disturb-390x844.png) |
| Dinner Committee | [1280×720](dinner-committee-1280x720.png) | [390×844](dinner-committee-390x844.png) |

Additional checks: [Dinner Committee at 844×390](dinner-committee-844x390.png), [Snack Break at 640×360](snack-break-640x360.png).

## Validation and limits

- `bun run check`: 171 tests, 3,996 assertions, lint, TypeScript, and production build pass. Two pre-existing missing-return-type lint warnings remain in `controllerOwnership.test.ts`.
- Focused tests verify gag ordering, emergence, second-pluck invitation, collision separation, tongue extension, reading time, and reduced-motion poses.
- Independent review found a negative-zero test mismatch and the unclear rotating-map cause/effect; both were resolved. Final scoped self-review checked the simplified map and accessible speaker separation.
- Browser evidence covers actual gallery playback and automatic return for all three scenes, the Skip Scene button, final poses, and shared Snack Break styling. Test setup supplied unlocked scene IDs through the existing localStorage format; no engine hook or modified runtime scheduler was used.
- Phone and short-landscape measurements show no horizontal page overflow. Skip button bottom was 716.7px at 390×844, 351.4px at 844×390, and 332.4px at 640×360; headings and captions were visible.
- This pass does not re-establish real controller/TV/device or screen-reader acceptance. Reduced-motion behavior was checked deterministically, not with OS-level browser emulation. Initial scheduling/recovery evidence is archived in the parent folder; it predates this timing polish.
- Recording stopped, the preview navigated to about:blank, and the task's Bun server stopped; port 3000 verified free. The tool-created blank tab has no running app; the available preview tools do not expose tab closure.

## Owner acceptance

**Needs Owner Input:** watch the preview and evaluate the joke content, reading pace, and visual feel before merge. This request explicitly requires that preview; the PR is left open for that review.

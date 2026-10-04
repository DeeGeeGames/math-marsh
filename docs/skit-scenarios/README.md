# Skit scenarios

The Shortcut, Do Not Disturb, and Dinner Committee keep their scene ids, titles, 16-second length, schedule, and gallery entries. Each joke now has a cause the picture shows. Snack Break is unchanged. The earlier polish notes in `docs/skit-expansion/polish/` stay as the record of that pass.

## Situations

- **The Shortcut** (after level 6). Lizard calls the small pad in the middle a shortcut. Fly is already across and says he will not fit. He jumps, splashes through that pad, and comes up wearing it. Fly tells him it is on his head.
- **Do Not Disturb** (after level 9). Spider waits in a finished web and asks for quiet. Fly plucks a loose strand twice. The web bounces Spider, and he says the sound is him.
- **Dinner Committee** (after level 12). The plan's arrows point at Fly. She turns the arrows around. Frog, Spider, and Lizard follow them and run into each other. Frog's tongue catches a lily pad again, and Fly says the arrows now point at them.

The arrow card is HTML. The word FLY stays upright while the arrow column turns. No new character art or audio was added. Scene ids, unlock storage, the level 3/6/9/12 schedule, gallery replay, and skip routes are unchanged.

## Preview

[Watch all three scenes](preview.mp4). About 51 seconds, 1280×720, recorded from gallery replay. Scene timing is the live clock. The file has no audio.

| Beat | Desktop/TV |
| --- | --- |
| The middle pad is too small | [will not fit](the-shortcut-will-not-fit.png) |
| Lizard goes through it | [sploosh](the-shortcut-sploosh.png) |
| The pad is a hat | [on your head](the-shortcut-on-your-head.png) |
| Fly plucks the trap | [leave the trap](do-not-disturb-leave-the-trap.png) |
| The noise is Spider | [that sound is me](do-not-disturb-sound-is-me.png) |
| The plan points at Fly | [point at the fly](dinner-point-at-the-fly.png) |
| The hunters follow the turned arrows | [bonk](dinner-bonk.png) |
| Frog catches a pad | [salad](dinner-salad.png) |
| The arrows point back | [point at you](dinner-point-at-you.png) |

Phone and short landscape: [Shortcut](the-shortcut-390x844.png), [Do Not Disturb](do-not-disturb-390x844.png), [Dinner Committee](dinner-390x844.png), [Dinner Committee at 844×390](dinner-844x390.png).

## Validation

`bun run check` exited 0: eslint reported 0 errors and 2 pre-existing warnings in `controllerOwnership.test.ts`, 171 tests passed with 4021 assertions, and the typecheck and production build completed.

Focused tests cover the shortcut splash-then-hat, both web plucks, the arrow turn followed by the closer collision and the tongue catch, reduced motion, and caption hold times.

Gallery playback at 1280×720 supplied the stills and the recording. Phone (390×844) and short landscape (844×390) frames showed no horizontal overflow, and Skip Scene stayed inside the viewport.

## Known softness

The fly sits above the right end of the plan rather than on the FLY pill. The caught pad rests just in front of the frog's mouth. Lizard overlaps the left edge of the sign at the start of Dinner Committee. The phone dinner frame is crowded. Do Not Disturb's last line begins while Fly is still on the strand; she leaves during that line.

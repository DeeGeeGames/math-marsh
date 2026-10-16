import { parseMixText } from './mixer';
import type { Mix } from './mixer';

// The owner's five-section selection. Keep this text reproducible independently
// of editable browser drafts. Tests match this recipe to the shared runtime score.
export const SAVED_ARRANGEMENT_TEXT = `Math Marsh mix v1
name: Gentle bloom
tempo: normal
opening-cycles: 2
section-cycles: 2
sections: 5
background: original (always on)
Gentle chords @100: - - A A A
Wooden plucks @100: - - A A -
High replies @100: - - - - -
Offbeat chords @100: - A A - -
Pulse & shaker @100: A A A - -
Moving plucks @100: - - - - -
Little chime @100: - - - - -
Soft chords @100: - - - - -
Light plucks @100: - - - - -
Answer melody @100: - - - - -
Extra shaker @100: - - - - -
note: `;

export const savedMix = function(): Mix { return parseMixText(SAVED_ARRANGEMENT_TEXT); };

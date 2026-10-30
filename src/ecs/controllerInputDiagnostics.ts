import type { InputState } from 'ecspresso/plugins/input/input';
import { getDesktopInputController } from '../platform/desktop';
import type { ControllerSelection } from './controllerSelection';
import type { GameAction } from './types';

const ACTIONS: readonly GameAction[] = ['up', 'down', 'left', 'right', 'eat', 'back', 'skip', 'pause'];
const BUTTONS = Array.from({ length: 17 }, (_, index) => index);

export const reportControllerInputDiagnostic = function (
	input: InputState<GameAction>,
	selection: Readonly<ControllerSelection>,
	screen: string | null,
): void {
	const report = getDesktopInputController()?.reportDiagnostics;
	if (!report) return;
	try {
		report({
			screen, ownerId: selection.owner?.id ?? null, ownerSlot: selection.owner?.slot ?? null,
			waitingForNeutral: selection.waitingForNeutral, blockFrame: selection.blockFrame,
			pageFocused: document.hasFocus(), pageHidden: document.hidden,
			controllers: input.gamepads.map((pad, slot) => ({
				slot, id: pad.id, connected: pad.connected,
				pressed: BUTTONS.filter(button => pad.isDown(button)),
				axes: [0, 1, 2, 3].map(axis => pad.axis(axis)),
			})),
			activeActions: ACTIONS.filter(action => input.actions.isActive(action)),
		});
	} catch { /* Diagnostics cannot interrupt controller ownership. */ }
};

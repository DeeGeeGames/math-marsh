import type { GamepadLike } from 'ecspresso/plugins/input/input';
import type { GameAction } from '../ecs/types';
import { getDesktopInputController, type DesktopController, type DesktopInputController } from './desktop';

const NATIVE_PREFIX = 'steam:';
const SLOT_COUNT = 4;
const BUTTON_ACTIONS: Readonly<Partial<Record<number, GameAction>>> = {
	12: 'up', 13: 'down', 14: 'left', 15: 'right', 0: 'eat', 1: 'back', 8: 'skip', 9: 'pause',
};

export const isSteamControllerId = function (id: string | null): boolean {
	return id?.startsWith(NATIVE_PREFIX) === true;
};

export type DesktopInputProvider = {
	poll: () => readonly (GamepadLike | null)[];
	setContext: (context: 'menu' | 'gameplay') => void;
	getController: (logicalId: string | null) => DesktopController | undefined;
};

export const createDesktopInputProvider = function (
	getDesktopInput: () => DesktopInputController | undefined,
	pollBrowser: () => readonly (GamepadLike | null)[],
): DesktopInputProvider {
	let slots: readonly (GamepadLike | null)[] = Array.from({ length: SLOT_COUNT }, () => null);
	let controllers = new Map<string, DesktopController>();
	let previousContext: 'menu' | 'gameplay' | undefined;
	let previousBridge: DesktopInputController | undefined;

	const poll = function (): readonly (GamepadLike | null)[] {
		const snapshot = getDesktopInput()?.snapshot();
		const devices = new Map<string, GamepadLike>();
		controllers = new Map();
		if (snapshot?.available) {
			for (const controller of snapshot.controllers) {
				const id = controller.kind === 'steam'
					? `${NATIVE_PREFIX}${controller.id}`
					: `desktop:${controller.id}`;
				if (devices.has(id)) continue;
				controllers.set(id, controller);
				devices.set(id, controller.kind === 'steam' ? {
					id, connected: true,
					buttons: Array.from({ length: 17 }, (_, index) => {
						const action = BUTTON_ACTIONS[index];
						const pressed = action !== undefined && controller.actions[action];
						return { pressed, value: pressed ? 1 : 0 };
					}),
					axes: [0, 0],
				} : { id, connected: true, buttons: controller.buttons, axes: controller.axes });
			}
		} else {
			// Preserve the browser's existing slot semantics, including empty slots.
			// Only the combined desktop provider needs logical slot allocation.
			const browser = pollBrowser();
			slots = Array.from({ length: SLOT_COUNT }, (_, index) => {
				const pad = browser[index];
				return pad?.connected ? {
					id: `browser:${index}:${pad.id}`, connected: true,
					buttons: pad.buttons, axes: pad.axes,
				} : null;
			});
			return slots;
		}
		// Preserve retained devices before assigning newly observed devices. Native
		// handles and SDL instance IDs survive desktop enumeration order changes.
		const retained = slots.map(pad => pad ? devices.get(pad.id) ?? null : null);
		const allocated = new Set(retained.flatMap(pad => pad ? [pad.id] : []));
		for (const [id, pad] of devices) {
			if (allocated.has(id)) continue;
			const empty = retained.indexOf(null);
			if (empty < 0) break;
			retained[empty] = pad;
			allocated.add(id);
		}
		slots = retained;
		return slots;
	};
	const setContext = function (context: 'menu' | 'gameplay'): void {
		const bridge = getDesktopInput();
		if (bridge === previousBridge && context === previousContext) return;
		bridge?.setContext(context);
		previousBridge = bridge;
		previousContext = context;
	};
	const getController = function (logicalId: string | null): DesktopController | undefined {
		return logicalId === null ? undefined : controllers.get(logicalId);
	};
	return { poll, setContext, getController };
};

export const desktopInputProvider = createDesktopInputProvider(
	getDesktopInputController,
	() => navigator.getGamepads(),
);

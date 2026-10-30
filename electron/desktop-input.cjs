const { createSteamInput } = require('./steam-input.cjs');

const UNAVAILABLE = { available: false, controllers: [] };
const button = function (pressed, value = pressed ? 1 : 0) { return { pressed, value }; };

// SDL's Steam handle identifies the actual device. Browser slot numbers and
// model names cannot safely identify an emulated copy of a Steam controller.
const conventionalSnapshot = function (controller) {
	const b = controller.buttons;
	const a = controller.axes;
	return {
		kind: 'gamepad',
		id: `sdl:${controller.device.id}:${controller.device.name}`,
		buttons: [b.a, b.b, b.x, b.y, b.leftShoulder, b.rightShoulder].map(value => button(value)).concat([
			button(a.leftTrigger > 0.5, a.leftTrigger), button(a.rightTrigger > 0.5, a.rightTrigger),
			...[b.back, b.start, b.leftStick, b.rightStick, b.dpadUp, b.dpadDown, b.dpadLeft, b.dpadRight, b.guide].map(value => button(value)),
		]),
		axes: [a.leftStickX, a.leftStickY, a.rightStickX, a.rightStickY],
	};
};

const createDesktopInput = function (options = {}) {
	const reportDiagnostic = function (data) {
		try { options.onDiagnostic?.('desktop', data); } catch { /* Preserve input behavior. */ }
	};
	const native = (options.createSteamInput ?? createSteamInput)(options);
	if (!native) {
		if (options.onDiagnostic) reportDiagnostic({ available: false, reason: 'native-initialization-unavailable' });
		return { sample: () => UNAVAILABLE, dispose: () => {} };
	}
	const controllers = new Map();
	const waitingForNeutral = new Set();
	let disposed = false;
	let previouslyFocused = true;
	const reportError = function (error) {
		try { options.onError?.(error); } catch { /* Logging cannot prevent cleanup or fallback. */ }
	};
	const dispose = function () {
		if (disposed) return;
		disposed = true;
		for (const controller of controllers.values()) {
			try { if (!controller.closed) controller.close(); } catch { /* Continue releasing other devices. */ }
		}
		controllers.clear();
		waitingForNeutral.clear();
		native.dispose();
	};
	try {
		// Electron owns the visible window, so SDL has no focused window of its
		// own. Forwarding below is gated by Electron focus and physical neutral.
		process.env.SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS = '1';
		// Keep Steam's emulated gamepads available for legacy/unbound layouts.
		// Exact Steam handles below suppress only copies served by native actions.
		process.env.SDL_GAMECONTROLLER_ALLOW_STEAM_VIRTUAL_GAMEPAD = '1';
		const sdl = (options.loadSdl ?? function () { return require('@kmamal/sdl'); })();
		return {
			sample: function (context, focused = true) {
				if (disposed) return UNAVAILABLE;
				try {
					const steam = native.sample(context);
					if (steam === null) {
						if (options.onDiagnostic) reportDiagnostic({ available: false, reason: 'native-sampling-unavailable' });
						dispose(); return UNAVAILABLE;
					}
					// Reading devices pumps SDL events, including Steam-handle changes.
					const devices = sdl.controller.devices;
					const ids = new Set(devices.map(device => device.id));
					for (const [id, controller] of controllers) {
						if (ids.has(id) && !controller.closed) continue;
						if (!controller.closed) controller.close();
						controllers.delete(id);
					}
					for (const device of devices) {
						if (!controllers.has(device.id)) controllers.set(device.id, sdl.controller.openDevice(device));
					}
					const nativeHandles = new Set(steam.map(controller => controller.steamHandle));
					const duplicates = options.onDiagnostic ? [] : null;
					const conventional = [...controllers.values()].flatMap(function (controller) {
						const handle = controller.steamHandle;
						if (handle && handle.length === 8 && nativeHandles.has(handle.readBigUInt64LE().toString())) {
							if (duplicates) duplicates.push(controller.device.id);
							return [];
						}
						return [conventionalSnapshot(controller)];
					});
					const snapshots = [...steam, ...conventional];
					// With no desktop-routed devices there is nothing to duplicate.
					// Let Chromium expose conventional pads that SDL cannot enumerate.
					if (snapshots.length === 0) {
						if (options.onDiagnostic) reportDiagnostic({ available: false, reason: 'no-desktop-devices', context, focused });
						return UNAVAILABLE;
					}
					const liveIds = new Set(snapshots.map(controller => controller.id));
					for (const id of waitingForNeutral) { if (!liveIds.has(id)) waitingForNeutral.delete(id); }
					const gated = snapshots.map(function (controller) {
						if (!focused || !previouslyFocused) waitingForNeutral.add(controller.id);
						const active = controller.kind === 'steam'
							? Object.values(controller.actions).some(Boolean)
							: controller.buttons.some(button => button.pressed) || controller.axes.some(axis => Math.abs(axis) > 0.5);
						if (focused && !active) waitingForNeutral.delete(controller.id);
						if (focused && !waitingForNeutral.has(controller.id)) return controller;
						return controller.kind === 'steam'
							? { ...controller, actions: Object.fromEntries(Object.keys(controller.actions).map(action => [action, false])) }
							: { ...controller, buttons: controller.buttons.map(() => button(false)), axes: controller.axes.map(() => 0) };
					});
					if (options.onDiagnostic) reportDiagnostic({
						available: true, context, focused, previouslyFocused,
						sdlDevices: devices.map(device => ({ id: device.id, suppressedDuplicate: duplicates.includes(device.id) })),
						controllers: snapshots.map(function (controller, index) {
							const output = gated[index];
							return {
								id: controller.id, kind: controller.kind,
								suppression: !focused ? 'window-unfocused' : waitingForNeutral.has(controller.id) ? 'waiting-for-neutral' : null,
								input: controller.kind === 'steam' ? controller.actions : {
									pressed: controller.buttons.flatMap((button, index) => button.pressed ? [index] : []), axes: controller.axes,
								},
								output: output.kind === 'steam' ? output.actions : {
									pressed: output.buttons.flatMap((button, index) => button.pressed ? [index] : []), axes: output.axes,
								},
							};
						}),
					});
					previouslyFocused = focused;
					return { available: true, controllers: gated };
				} catch (error) {
					if (options.onDiagnostic) reportDiagnostic({ available: false, reason: 'sampling-error', message: String(error) });
					reportError(error);
					dispose();
					return UNAVAILABLE;
				}
			},
			dispose,
		};
	} catch (error) {
		if (options.onDiagnostic) reportDiagnostic({ available: false, reason: 'sdl-initialization-error', message: String(error) });
		reportError(error);
		dispose();
		return { sample: () => UNAVAILABLE, dispose };
	}
};

module.exports = { createDesktopInput };

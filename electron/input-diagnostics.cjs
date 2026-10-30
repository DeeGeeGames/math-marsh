const ACTIONS = ['up', 'down', 'left', 'right', 'eat', 'back', 'skip', 'pause'];
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

// Opt-in, bounded stdout logging; Steam launch-option redirection captures it.
// Logging failures must never change controller routing or game state.
const createInputDiagnostics = function (options = {}) {
	if ((options.environment ?? process.env).MATH_MARSH_INPUT_DIAGNOSTICS !== '1') return null;
	const now = options.now ?? function () { return performance.now(); };
	const emit = options.emit ?? function (line) { console.info(line); };
	const startedAt = now();
	const previous = new Map();
	let bytes = 0;
	return {
		record: function (stage, data) {
			if (bytes >= MAX_OUTPUT_BYTES) return;
			try {
				const at = now();
				const serialized = JSON.stringify(data);
				const last = previous.get(stage);
				if (last?.serialized === serialized && at - last.at < 1000) return;
				const line = `[controller-input] ${JSON.stringify({ elapsedMs: Math.round(at - startedAt), stage, data })}`;
				bytes += Buffer.byteLength(line) + 1;
				if (bytes >= MAX_OUTPUT_BYTES) {
					emit('[controller-input] Output limit reached; restart the game for a new capture.');
					return;
				}
				previous.set(stage, { serialized, at });
				emit(line);
			} catch { /* Diagnostics cannot interrupt play. */ }
		},
	};
};

const shortString = function (value) { return typeof value === 'string' && value.length <= 256; };
const slot = function (value) { return Number.isInteger(value) && value >= 0 && value < 4; };
const object = function (value) { return value !== null && typeof value === 'object' && !Array.isArray(value); };

// Whitelist the renderer payload. Never log arbitrary renderer objects, text
// entry, profile data, prompt glyphs, or user/account identifiers.
const normalizeRendererInputDiagnostic = function (value) {
	if (!object(value) || !(value.screen === null || shortString(value.screen))
		|| !(value.ownerId === null || shortString(value.ownerId))
		|| !(value.ownerSlot === null || slot(value.ownerSlot))
		|| !['waitingForNeutral', 'blockFrame', 'pageFocused', 'pageHidden'].every(key => typeof value[key] === 'boolean')
		|| !Array.isArray(value.controllers) || value.controllers.length > 4
		|| !Array.isArray(value.activeActions) || value.activeActions.length > ACTIONS.length
		|| !value.activeActions.every(action => ACTIONS.includes(action))) return null;
	if (value.bridge !== undefined && (!object(value.bridge)
		|| typeof value.bridge.fresh !== 'boolean' || typeof value.bridge.available !== 'boolean')) return null;
	const controllers = [];
	for (const controller of value.controllers) {
		if (!object(controller) || !slot(controller.slot) || typeof controller.connected !== 'boolean'
			|| !(controller.id === null || shortString(controller.id))
			|| !Array.isArray(controller.pressed) || controller.pressed.length > 17
			|| !controller.pressed.every(button => Number.isInteger(button) && button >= 0 && button < 17)
			|| !Array.isArray(controller.axes) || controller.axes.length > 4
			|| !controller.axes.every(axis => Number.isFinite(axis) && Math.abs(axis) <= 1)) return null;
		controllers.push({ slot: controller.slot, connected: controller.connected, id: controller.id,
			pressed: [...controller.pressed], axes: [...controller.axes] });
	}
	return {
		screen: value.screen, ownerId: value.ownerId, ownerSlot: value.ownerSlot,
		waitingForNeutral: value.waitingForNeutral, blockFrame: value.blockFrame,
		pageFocused: value.pageFocused, pageHidden: value.pageHidden,
		controllers, activeActions: [...value.activeActions],
		...(value.bridge === undefined ? {} : { bridge: { fresh: value.bridge.fresh, available: value.bridge.available } }),
	};
};

module.exports = { createInputDiagnostics, normalizeRendererInputDiagnostic };

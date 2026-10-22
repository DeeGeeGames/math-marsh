const { readFileSync, statSync } = require('node:fs');
const { join, resolve } = require('node:path');

const APP_ID = '4927380';
const ACTIONS = ['up', 'down', 'left', 'right', 'eat', 'back', 'skip', 'pause'];
const SET_NAMES = { menu: 'Menu', gameplay: 'Gameplay' };
const MAX_GLYPH_BYTES = 256 * 1024;
const NATIVE_ROUTE_GRACE_MS = 250;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// Loaded only by the desktop main process. A direct standalone launch never
// loads the native dependency, attempts Steam initialization, or restarts Steam.
const createSteamInput = function (options = {}) {
	const environment = options.environment ?? process.env;
	if (environment.SteamAppId !== APP_ID && environment.SteamGameId !== APP_ID) return null;
	const now = options.now ?? function () { return performance.now(); };
	let steam;
	let initialized = false;
	let inputInitialized = false;
	let disposed = false;
	let generation = 0;
	let connections = new Map();
	const glyphs = new Map();
	const reportError = function (error) {
		try { options.onError?.(error); } catch { /* Logging cannot block fallback. */ }
	};
	const dispose = function () {
		if (disposed) return;
		disposed = true;
		connections.clear();
		glyphs.clear();
		try { if (inputInitialized) steam.input.shutdown(); }
		catch (error) { reportError(error); }
		try { if (initialized) steam.shutdown(); }
		catch (error) { reportError(error); }
	};
	try {
		const loadSteam = options.loadSteam ?? function () {
			return require('steamworks-ffi-node').SteamworksSDK.getInstance();
		};
		steam = loadSteam();
		const resourcesPath = options.resourcesPath ?? process.resourcesPath ?? resolve(__dirname, '..');
		const sdkRoot = options.sdkRoot ?? environment.MATH_MARSH_STEAM_SDK_ROOT ?? join(resourcesPath, 'steamworks_sdk');
		const manifestPath = options.manifestPath ?? join(resourcesPath, 'steam-input', 'game_actions.vdf');
		steam.setSdkPath(resolve(sdkRoot));
		initialized = steam.init({ appId: Number(APP_ID) });
		if (!initialized) throw new Error('Steamworks initialization failed');
		if (!steam.input.setInputActionManifestFilePath(resolve(manifestPath))) throw new Error('Steam Input manifest rejected');
		inputInitialized = steam.input.init(true);
		if (!inputInitialized) throw new Error('Steam Input initialization failed');
		const sets = Object.fromEntries(Object.entries(SET_NAMES).map(function ([context, name]) {
			const handle = steam.input.getActionSetHandle(name);
			const actions = Object.fromEntries(ACTIONS.map(function (action) {
				return [action, steam.input.getDigitalActionHandle(`${context}_${action}`)];
			}));
			if (handle === 0n || Object.values(actions).includes(0n)) throw new Error(`Steam Input ${name} actions unavailable`);
			return [context, { handle, actions }];
		}));
		const readGlyph = function (origin) {
			try {
				// Paths originate exclusively from Steam, never the renderer. Small=0.
				const path = steam.input.getGlyphPNGForActionOrigin(origin, 0, 0);
				if (!path) return undefined;
				if (glyphs.has(path)) return glyphs.get(path);
				const stat = statSync(path);
				if (!stat.isFile() || stat.size > MAX_GLYPH_BYTES) return undefined;
				const bytes = readFileSync(path);
				if (bytes.length > MAX_GLYPH_BYTES || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return undefined;
				const data = `data:image/png;base64,${bytes.toString('base64')}`;
				if (glyphs.size >= 128) glyphs.clear();
				glyphs.set(path, data);
				return data;
			} catch { return undefined; }
		};
		return {
			sample: function (context) {
				if (disposed) return null;
				const set = sets[context];
				if (!set) return [];
				try {
					steam.runCallbacks();
					// Steam computes action data in runFrame. Activate before that update,
					// including devices already known to Steam but new to this provider.
					const beforeHandles = steam.input.getConnectedControllers();
					const beforeFrame = new Set(beforeHandles.map(String));
					for (const handle of beforeHandles) {
						steam.input.activateActionSet(handle, set.handle);
					}
					steam.input.runFrame();
					const handles = steam.input.getConnectedControllers();
					const current = new Map();
					const sampledAt = now();
					const snapshots = handles.flatMap(function (handle) {
						const steamHandle = String(handle);
						const previous = connections.get(steamHandle);
						const id = previous?.id ?? `steam:${steamHandle}:${++generation}`;
						const connection = { id, context, suppressed: previous?.suppressed === true || (previous !== undefined && previous.context !== context) };
						current.set(steamHandle, connection);
						if (!beforeFrame.has(steamHandle)) steam.input.activateActionSet(handle, set.handle);
						let settled = beforeFrame.has(steamHandle) && steam.input.getCurrentActionSet(handle) === set.handle;
						let hasActiveAction = false;
						let hasOrigins = false;
						const actions = {};
						const prompts = {};
						for (const action of ACTIONS) {
							const data = steam.input.getDigitalActionData(handle, set.actions[action]);
							const origins = steam.input.getDigitalActionOrigins(handle, set.handle, set.actions[action]).slice(0, 8);
							hasActiveAction ||= data.active === true;
							hasOrigins ||= origins.length > 0;
							// An inactive bound action is transitional, never evidence of
							// physical release. Unbound actions can remain inactive forever.
							if (origins.length > 0 && data.active !== true) settled = false;
							actions[action] = data.active === true && data.state === true;
							prompts[action] = origins.map(function (origin) {
								const label = steam.input.getStringForActionOrigin(origin) || action;
								const glyph = readGlyph(origin);
								return glyph ? { label, glyph } : { label };
							});
						}
						settled &&= hasActiveAction && hasOrigins;
						// Legacy Steam layouts report a handle without providing named
						// actions. Leave those devices to SDL. Brief empty updates from
						// an established native route must not churn ownership on set changes.
						// bActive can be true for an active action set even when its
						// layout binds no named actions. Origins prove usable bindings.
						const hasNativeData = hasOrigins;
						connection.missingSince = hasNativeData ? undefined : previous?.missingSince ?? sampledAt;
						connection.nativeRoute = hasNativeData || (previous?.nativeRoute === true
							&& sampledAt - connection.missingSince < NATIVE_ROUTE_GRACE_MS);
						if (!settled) connection.suppressed = true;
						if (connection.suppressed || !settled) {
							if (settled && !Object.values(actions).some(Boolean)) connection.suppressed = false;
							for (const action of ACTIONS) actions[action] = false;
						}
						return connection.nativeRoute ? [{ id, kind: 'steam', steamHandle, actions, prompts }] : [];
					});
					connections = current;
					return snapshots;
				} catch (error) {
					reportError(error);
					dispose();
					return null;
				}
			},
			dispose,
		};
	} catch (error) {
		reportError(error);
		dispose();
		return null;
	}
};

module.exports = { createSteamInput };

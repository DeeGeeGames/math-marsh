const { join, resolve } = require('node:path');

const APP_ID = '4927380';
// Math Marsh Demo, assigned by Steamworks.
const DEMO_APP_ID = '5493870';
const getSteamAppIdentity = function (environment = process.env, demoAppId = DEMO_APP_ID) {
	const appId = environment.SteamAppId ?? environment.SteamGameId;
	if (appId === APP_ID) return { appId, role: 'paid' };
	if (typeof demoAppId === 'string' && /^[1-9]\d*$/.test(demoAppId) && appId === demoAppId) return { appId, role: 'demo' };
	return null;
};
const isSteamLaunch = function (environment = process.env, demoAppId = DEMO_APP_ID) {
	return getSteamAppIdentity(environment, demoAppId) !== null;
};

// The app owns this session. Input failures must not shut down save identity.
const createSteamSession = function (options = {}) {
	const identity = getSteamAppIdentity(options.environment, options.demoAppId);
	if (!identity) return null;
	let steam;
	let initialized = false;
	let disposed = false;
	const dispose = function () {
		if (disposed) return;
		disposed = true;
		if (initialized) steam.shutdown();
	};
	try {
		steam = (options.loadSteam ?? function () {
			return require('steamworks-ffi-node').SteamworksSDK.getInstance();
		})();
		const resourcesPath = options.resourcesPath ?? process.resourcesPath ?? resolve(__dirname, '..');
		const sdkRoot = options.sdkRoot ?? (options.environment ?? process.env).MATH_MARSH_STEAM_SDK_ROOT ?? join(resourcesPath, 'steamworks_sdk');
		steam.setSdkPath(resolve(sdkRoot));
		initialized = steam.init({ appId: Number(identity.appId) });
		if (!initialized) throw new Error('Steamworks initialization failed');
		return { steam, dispose, ...identity };
	} catch (error) {
		try { dispose(); } catch { /* Preserve the initialization error. */ }
		try { options.onError?.(error); } catch { /* Logging cannot block fallback. */ }
		return null;
	}
};

module.exports = { APP_ID, DEMO_APP_ID, createSteamSession, isSteamLaunch, getSteamAppIdentity };

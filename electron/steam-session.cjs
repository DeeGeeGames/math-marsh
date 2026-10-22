const { join, resolve } = require('node:path');

const APP_ID = '4927380';
const isSteamLaunch = function (environment = process.env) {
	return environment.SteamAppId === APP_ID || environment.SteamGameId === APP_ID;
};

// The app owns this session. Input failures must not shut down save identity.
const createSteamSession = function (options = {}) {
	if (!isSteamLaunch(options.environment)) return null;
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
		initialized = steam.init({ appId: Number(APP_ID) });
		if (!initialized) throw new Error('Steamworks initialization failed');
		return { steam, dispose };
	} catch (error) {
		try { dispose(); } catch { /* Preserve the initialization error. */ }
		try { options.onError?.(error); } catch { /* Logging cannot block fallback. */ }
		return null;
	}
};

module.exports = { createSteamSession, isSteamLaunch };

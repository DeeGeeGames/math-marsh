const { PROFILE_STORAGE_KEYS } = require('./profile-storage-keys.cjs');

const createProfileStorageBridge = function (request, legacyStorage) {
	const call = function (operation, ...args) {
		const result = request(operation, ...args);
		if (!result?.ok) throw new Error('Steam profile storage unavailable');
		return result.value;
	};
	// Failure must still expose a storage adapter: falling back to shared
	// localStorage could load another Steam account's profiles.
	try { if (call('status') === 'standalone') return undefined; } catch { /* Reads will report session-only. */ }
	let initialized = false;
	const initialize = function () {
		if (initialized) return;
		if (call('status') === 'migration') {
			const storage = legacyStorage();
			const entries = PROFILE_STORAGE_KEYS.flatMap(function (key) {
				const value = storage.getItem(key);
				return value === null ? [] : [[key, value]];
			});
			call('migrate', Object.fromEntries(entries));
		}
		initialized = true;
	};
	return {
		getPersistenceMode: function () {
			initialize();
			const status = call('status');
			if (status === 'read-only') return 'read-only';
			if (status === 'ready') return 'read-write';
			throw new Error('Steam profile storage unavailable');
		},
		getItem: function (key) { initialize(); return call('get', key); },
		setItem: function (key, value) { initialize(); call('set', key, value); },
	};
};

module.exports = { createProfileStorageBridge };

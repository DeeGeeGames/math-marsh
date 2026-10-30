const registeredNames = require('./achievement-names.json');
const { APP_ID } = require('./steam-session.cjs');

// unlockAchievement includes SetAchievement + StoreStats in SDK 0.11.3.
const createAchievementQueue = function(session, names = registeredNames) {
	const allowed = new Set(names);
	const pending = new Set();
	const stored = new Set();
	const attempted = new Set();
	let running;
	let disposed = false;
	const enabled = session?.role === 'paid' && session.appId === APP_ID;
	const flush = function() {
		if (disposed || !enabled || pending.size === 0) return Promise.resolve();
		if (running) return running;
		running = (async function() {
			for (const name of pending) {
				if (disposed) break;
				try {
					// Request again if startup stats were unavailable. No private SDK APIs.
					if (!await session.steam.stats.requestUserStats(session.steam.getStatus().steamId) || disposed) break;
					const achievement = await session.steam.achievements.getAchievementByName(name);
					if (disposed) break;
					if (!achievement) break;
					// A failed StoreStats can leave the in-memory unlock bit set.
					// Never mistake that bit for a previously stored achievement.
					if (!attempted.has(name) && achievement.unlocked) {
						stored.add(name);
						pending.delete(name);
						continue;
					}
					attempted.add(name);
					if (!await session.steam.achievements.unlockAchievement(name)) break;
					stored.add(name);
					pending.delete(name);
				} catch { break; }
			}
		})().finally(function() { running = undefined; });
		return running;
	};
	return {
		submit: function(request) {
			if (!Array.isArray(request) || request.length > allowed.size
				|| request.some(name => typeof name !== 'string' || !allowed.has(name))) {
				throw new Error('Unregistered achievement');
			}
			if (!enabled || disposed) return;
			for (const name of request) if (!stored.has(name)) pending.add(name);
		},
		flush,
		dispose: function() { disposed = true; pending.clear(); },
	};
};
module.exports = { createAchievementQueue };

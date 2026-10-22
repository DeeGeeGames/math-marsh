import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';
const { createSteamSession } = createRequire(import.meta.url)('./steam-session.cjs');

describe('app-owned Steam session', function () {
	test('standalone does not load the SDK', function () {
		expect(createSteamSession({ environment: {}, loadSteam: function () { throw new Error('must not load'); } })).toBeNull();
	});
	test('initializes without a controller subsystem and disposes exactly once', function () {
		let shutdowns = 0;
		let appId;
		const session = createSteamSession({ environment: { SteamGameId: '4927380' }, loadSteam: function () {
			return {
				setSdkPath: function () {},
				init: function (options) { appId = options.appId; return true; },
				shutdown: function () { shutdowns++; },
			};
		} });
		expect(appId).toBe(4927380);
		session.dispose();
		session.dispose();
		expect(shutdowns).toBe(1);
	});
	test('SDK initialization failure remains unavailable', function () {
		let reported = false;
		expect(createSteamSession({
			environment: { SteamAppId: '4927380' },
			loadSteam: function () { return { setSdkPath: function () {}, init: function () { return false; } }; },
			onError: function () { reported = true; },
		})).toBeNull();
		expect(reported).toBe(true);
	});
});

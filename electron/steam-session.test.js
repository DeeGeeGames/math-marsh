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

describe('Steam process app identity', function () {
	const { getSteamAppIdentity, DEMO_APP_ID } = createRequire(import.meta.url)('./steam-session.cjs');
	test('assigned demo identity is recognized and primary process id takes precedence', function () {
		expect(DEMO_APP_ID).toBe('5493870');
		expect(getSteamAppIdentity({ SteamAppId: DEMO_APP_ID })).toEqual({ appId: DEMO_APP_ID, role: 'demo' });
		expect(getSteamAppIdentity({ SteamGameId: DEMO_APP_ID })).toEqual({ appId: DEMO_APP_ID, role: 'demo' });
		expect(getSteamAppIdentity({ SteamAppId: '123', SteamGameId: '4927380' })).toBeNull();
		expect(getSteamAppIdentity({ SteamAppId: '123' })).toBeNull();
		expect(getSteamAppIdentity({})).toBeNull();
		expect(getSteamAppIdentity({ SteamAppId: '4927380' })).toEqual({ appId: '4927380', role: 'paid' });
	});
	test('demo initializes as its own assigned process id', function () {
		let initializedId;
		const session = createSteamSession({
			environment: { SteamAppId: DEMO_APP_ID },
			loadSteam: function () { return {
				setSdkPath: function () {}, init: function ({ appId }) { initializedId = appId; return true; }, shutdown: function () {},
			}; },
		});
		expect(initializedId).toBe(5493870);
		expect(session.role).toBe('demo');
		expect(session.appId).toBe(DEMO_APP_ID);
		session.dispose();
	});
});

import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, unlinkSync } from 'node:fs';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
	loadPlayerProfiles, createPlayerProfile, updateActivePlayerProfile,
	renamePlayerProfile, deletePlayerProfile, switchActivePlayerProfile,
	PLAYER_PROFILES_KEY, ACTIVE_PLAYER_PROFILE_KEY,
} from '../src/ecs/playerProfiles';
import { MATH_PROGRESS_KEY } from '../src/ecs/mathProgressStore';
import { SKIT_PROGRESS_KEY } from '../src/ecs/skitProgress';
import { ONBOARDING_STORAGE_KEYS } from '../src/onboarding/gameplayOnboarding';

const require = createRequire(import.meta.url);
const { createProfileStorage, MAX_SAVE_BYTES } = require('./profile-storage.cjs');
const { createProfileStorageBridge } = require('./profile-storage-bridge.cjs');
const { PROFILE_STORAGE_KEYS } = require('./profile-storage-keys.cjs');
const USER_A = '76561198012345678';
const USER_B = '76561198098765432';
const savePath = function (root, id = USER_A) { return join(root, 'math-marsh', 'steam-saves', id, 'progress.json'); };
const withRoot = function (run) {
	const root = mkdtempSync(join(tmpdir(), 'math-marsh-save-'));
	try { return run(root); } finally { rmSync(root, { recursive: true, force: true }); }
};
const bridgeFor = function (native, legacy = {}, onRead = function () {}) {
	return createProfileStorageBridge(function (operation, ...args) {
		try {
			if (operation === 'status') return { ok: true, value: native.status() };
			if (operation === 'migrate') native.migrate(args[0]);
			if (operation === 'get') return { ok: true, value: native.getItem(args[0]) };
			if (operation === 'set') native.setItem(args[0], args[1]);
			return { ok: true };
		} catch { return { ok: false }; }
	}, function () {
		onRead();
		return { getItem: function (key) { return legacy[key] ?? null; } };
	});
};

describe('Steam account profile storage', function () {
	test('allowlist matches every portable legacy/profile key and excludes settings', function () {
		expect(PROFILE_STORAGE_KEYS).toEqual([
			PLAYER_PROFILES_KEY, ACTIVE_PLAYER_PROFILE_KEY, MATH_PROGRESS_KEY,
			SKIT_PROGRESS_KEY, ...Object.values(ONBOARDING_STORAGE_KEYS),
		]);
	});

	test('migrates legacy progress once, saves profile changes offline, and reloads on another device', function () {
		withRoot(function (root) {
			const legacy = {
				[MATH_PROGRESS_KEY]: JSON.stringify({ version: 1, tracks: { add: { currentStep: 4, highestUnlockedStep: 7 } } }),
				[SKIT_PROGRESS_KEY]: JSON.stringify(['snack-break']),
				[ONBOARDING_STORAGE_KEYS.basics]: 'completed',
				'fullscreen-enabled': '1',
			};
			const storage = bridgeFor(createProfileStorage({ appData: root, userData: root, steamId: USER_A }), legacy);
			let state = createPlayerProfile(loadPlayerProfiles(storage), 'Maya', 'maya', storage).state;
			expect(state.profiles[0].mathProgress.add.highestUnlockedStep).toBe(7);
			expect(state.profiles[0].onboarding.basics).toBe('completed');
			expect(state.profiles[0].skitProgress).toEqual(['snack-break']);
			state = updateActivePlayerProfile(state, function (profile) {
				return { ...profile, mathProgress: { ...profile.mathProgress, add: { currentStep: 8, highestUnlockedStep: 8 } } };
			}, storage);
			state = createPlayerProfile(state, 'Alex', 'alex', storage).state;
			state = renamePlayerProfile(state, 'maya', 'Maya 2', storage).state;
			state = switchActivePlayerProfile(state, 'maya', storage).state;
			state = deletePlayerProfile(state, 'alex', storage).state;
			const saved = JSON.parse(readFileSync(savePath(root), 'utf8'));
			expect(saved.values['fullscreen-enabled']).toBeUndefined();
			// Model Auto-Cloud's file transfer, without copying local migration metadata.
			withRoot(function (otherDevice) {
				mkdirSync(dirname(savePath(otherDevice)), { recursive: true });
				cpSync(savePath(root), savePath(otherDevice));
				const restored = loadPlayerProfiles(bridgeFor(createProfileStorage({ appData: otherDevice, userData: otherDevice, steamId: USER_A }), {}, function () {
					throw new Error('Cloud save must win over legacy storage');
				}));
				expect(restored.profiles).toEqual(state.profiles);
				expect(restored.activeProfileId).toBe('maya');
				expect(restored.persistence).toBe('persistent');
			});
		});
	});

	test('keeps Steam users isolated and never reimports shared legacy progress for a second account', function () {
		withRoot(function (root) {
			const oldProfile = { [MATH_PROGRESS_KEY]: JSON.stringify({ version: 1, tracks: { add: { currentStep: 5, highestUnlockedStep: 5 } } }) };
			const first = bridgeFor(createProfileStorage({ appData: root, userData: root, steamId: USER_A }), oldProfile);
			createPlayerProfile(loadPlayerProfiles(first), 'First', 'a', first);
			const second = bridgeFor(createProfileStorage({ appData: root, userData: root, steamId: USER_B }), oldProfile, function () {
				throw new Error('Other account must not inspect legacy storage');
			});
			expect(loadPlayerProfiles(second).profiles).toEqual([]);
			const state = createPlayerProfile(loadPlayerProfiles(second), 'Second', 'b', second).state;
			expect(state.profiles[0].mathProgress.add.highestUnlockedStep).toBe(1);
			expect(loadPlayerProfiles(first).profiles[0].name).toBe('First');
		});
	});

	test('migrates existing named profiles without changing the original browser values', function () {
		withRoot(function (root) {
			const legacy = {};
			const oldStorage = { getItem: key => legacy[key] ?? null, setItem: (key, value) => { legacy[key] = value; } };
			createPlayerProfile(loadPlayerProfiles(oldStorage), 'Existing', 'old', oldStorage);
			const original = { ...legacy };
			const storage = bridgeFor(createProfileStorage({ appData: root, userData: root, steamId: USER_A }), legacy);
			expect(loadPlayerProfiles(storage).profiles[0].name).toBe('Existing');
			expect(legacy).toEqual(original);
		});
	});

	for (const corrupt of ['{broken', 'null', JSON.stringify({ version: 2, values: {} }), JSON.stringify({ version: 1, values: { secret: 123 } }), 'x'.repeat(MAX_SAVE_BYTES + 1)]) {
		test(`preserves corrupt, future, or oversized saves (${corrupt.slice(0, 24)})`, function () {
			withRoot(function (root) {
				mkdirSync(dirname(savePath(root)), { recursive: true });
				writeFileSync(savePath(root), corrupt);
				const storage = bridgeFor(createProfileStorage({ appData: root, userData: root, steamId: USER_A }));
				const state = loadPlayerProfiles(storage);
				expect(state.persistence).toBe('session-only');
				expect(state.canPersist).toBe(false);
				createPlayerProfile(state, 'Temporary', 'temp', storage);
				expect(readFileSync(savePath(root), 'utf8')).toBe(corrupt);
			});
		});
	}

	test('failed atomic replacement leaves the previous save readable and can retry', function () {
		withRoot(function (root) {
			let failWrite = false;
			const io = { ...fs, renameSync: function (...args) {
				if (failWrite) throw new Error('disk failure');
				fs.renameSync(...args);
			} };
			const storage = bridgeFor(createProfileStorage({ appData: root, userData: root, steamId: USER_A, io }));
			const state = createPlayerProfile(loadPlayerProfiles(storage), 'Original', 'one', storage).state;
			const original = readFileSync(savePath(root), 'utf8');
			failWrite = true;
			const failed = renamePlayerProfile(state, 'one', 'Changed', storage).state;
			expect(failed.persistence).toBe('session-only');
			expect(readFileSync(savePath(root), 'utf8')).toBe(original);
			expect(existsSync(`${savePath(root)}.tmp`)).toBe(false);
			failWrite = false;
			const retried = renamePlayerProfile(failed, 'one', 'Retried', storage).state;
			expect(retried.persistence).toBe('persistent');
			expect(loadPlayerProfiles(bridgeFor(createProfileStorage({ appData: root, userData: root, steamId: USER_A }))).profiles[0].name).toBe('Retried');
		});
	});

	test('a failed migration can retry only for the claimed account', function () {
		withRoot(function (root) {
			const io = { ...fs, renameSync: function (from, to) {
				if (to === savePath(root)) throw new Error('migration interrupted');
				fs.renameSync(from, to);
			} };
			const failed = bridgeFor(createProfileStorage({ appData: root, userData: root, steamId: USER_A, io }));
			expect(loadPlayerProfiles(failed).persistence).toBe('session-only');
			expect(createProfileStorage({ appData: root, userData: root, steamId: USER_B }).status()).toBe('ready');
			expect(createProfileStorage({ appData: root, userData: root, steamId: USER_A }).status()).toBe('migration');
		});
	});

	test('unreadable legacy storage never seeds an empty cloud save', function () {
		withRoot(function (root) {
			const storage = bridgeFor(createProfileStorage({ appData: root, userData: root, steamId: USER_A }), {}, function () { throw new Error('storage denied'); });
			expect(loadPlayerProfiles(storage).persistence).toBe('session-only');
			expect(existsSync(savePath(root))).toBe(false);
		});
	});

	test('deleting a migrated save never resurrects the old browser profiles', function () {
		withRoot(function (root) {
			const initial = createProfileStorage({ appData: root, userData: root, steamId: USER_A });
			initial.migrate({ [ACTIVE_PLAYER_PROFILE_KEY]: 'old' });
			unlinkSync(savePath(root));
			const fresh = createProfileStorage({ appData: root, userData: root, steamId: USER_A });
			expect(fresh.status()).toBe('ready');
			expect(fresh.getItem(ACTIVE_PLAYER_PROFILE_KEY)).toBeNull();
		});
	});

	test('recovers a committed migration when marking completion was interrupted', function () {
		withRoot(function (root) {
			let ownerWrites = 0;
			const io = { ...fs, renameSync: function (from, to) {
				if (to.endsWith('steam-save-migration.json') && ++ownerWrites === 2) throw new Error('completion interrupted');
				fs.renameSync(from, to);
			} };
			const initial = createProfileStorage({ appData: root, userData: root, steamId: USER_A, io });
			expect(function () { initial.migrate({ [ACTIVE_PLAYER_PROFILE_KEY]: 'preserved' }); }).toThrow();
			const recovered = createProfileStorage({ appData: root, userData: root, steamId: USER_A });
			expect(recovered.status()).toBe('ready');
			expect(recovered.getItem(ACTIVE_PLAYER_PROFILE_KEY)).toBe('preserved');
			expect(JSON.parse(readFileSync(join(root, 'steam-save-migration.json'), 'utf8')).imported).toBe(true);
		});
	});

	test('identity failure keeps the storage adapter blocked, while standalone uses browser storage', function () {
		const blocked = createProfileStorageBridge(function () { return { ok: false }; }, function () { throw new Error('must not read legacy'); });
		expect(blocked).toBeDefined();
		expect(loadPlayerProfiles(blocked).canPersist).toBe(false);
		expect(createProfileStorageBridge(function () { return { ok: true, value: 'standalone' }; })).toBeUndefined();
		for (const steamId of [undefined, '0', '../escape', USER_A + '/x']) {
			expect(function () { createProfileStorage({ userData: '/unused', steamId }); }).toThrow();
		}
	});

	test('rejects nonportable keys and oversized writes without changing the save', function () {
		withRoot(function (root) {
			const storage = createProfileStorage({ appData: root, userData: root, steamId: USER_A });
			storage.migrate({});
			const before = readFileSync(savePath(root), 'utf8');
			expect(function () { storage.setItem('fullscreen-enabled', '1'); }).toThrow();
			expect(function () { storage.setItem(PLAYER_PROFILES_KEY, 'x'.repeat(MAX_SAVE_BYTES)); }).toThrow();
			expect(readFileSync(savePath(root), 'utf8')).toBe(before);
		});
	});
});

const writeEnvelope = function (root, envelope) {
	mkdirSync(dirname(savePath(root)), { recursive: true });
	writeFileSync(savePath(root), JSON.stringify(envelope));
};
const futureCompatibleDemo = function () {
	return {
		version: 1, saveOwner: 'demo', envelopeExtension: { version: 8, nested: ['retained'] },
		values: {
			[PLAYER_PROFILES_KEY]: JSON.stringify({ version: 1, profiles: [{
				id: 'imported', name: 'Imported', learnerData: {
					mathProgress: { add: { currentStep: 4, highestUnlockedStep: 8 }, futureTrack: { arbitrary: true } },
					skitProgress: ['future-scene'], onboarding: {}, practiceProgress: { version: 99, future: [1, 2] },
					futureLearnerField: { retained: true },
				},
			}] }),
			[ACTIVE_PLAYER_PROFILE_KEY]: 'imported', 'future.storage.key': '{"unchanged":true}',
		},
	};
};

describe('Steam demo handoff', function () {
	test('promotes the raw envelope once and preserves every unknown JSON and string value', function () {
		withRoot(function (root) {
			const fixture = futureCompatibleDemo();
			writeEnvelope(root, fixture);
			let promotions = 0;
			const io = { ...fs, renameSync: function (from, to) {
				if (to === savePath(root)) promotions++;
				fs.renameSync(from, to);
			} };
			const paid = createProfileStorage({ appData: root, userData: root, steamId: USER_A, role: 'paid', io });
			expect(paid.status()).toBe('ready');
			expect(JSON.parse(readFileSync(savePath(root), 'utf8'))).toEqual({ ...fixture, saveOwner: 'paid' });
			paid.status();
			paid.getItem(PLAYER_PROFILES_KEY);
			expect(promotions).toBe(1);
			paid.setItem(ACTIVE_PLAYER_PROFILE_KEY, 'changed');
			expect(JSON.parse(readFileSync(savePath(root), 'utf8'))).toEqual({
				...fixture, saveOwner: 'paid', values: { ...fixture.values, [ACTIVE_PLAYER_PROFILE_KEY]: 'changed' },
			});
		});
	});

	for (const saveOwner of [undefined, 'paid']) {
		test(`demo reads ${saveOwner ?? 'legacy paid'} ownership without changing bytes or reading legacy storage`, function () {
			withRoot(function (root) {
				const fixture = { ...futureCompatibleDemo(), saveOwner };
				writeEnvelope(root, fixture);
				const original = readFileSync(savePath(root), 'utf8');
				const native = createProfileStorage({ appData: root, userData: root, steamId: USER_A, role: 'demo' });
				const bridge = bridgeFor(native, {}, function () { throw new Error('must not inspect legacy'); });
				expect(bridge.getPersistenceMode()).toBe('read-only');
				expect(bridge.getItem(PLAYER_PROFILES_KEY)).toBe(fixture.values[PLAYER_PROFILES_KEY]);
				expect(function () { bridge.setItem(ACTIVE_PLAYER_PROFILE_KEY, 'temporary'); }).toThrow();
				expect(function () { native.migrate({}); }).toThrow();
				expect(readFileSync(savePath(root), 'utf8')).toBe(original);
				expect(existsSync(join(root, 'steam-save-migration.json'))).toBe(false);
			});
		});
	}

	test('demo first creates demo ownership; later demo session detects paid promotion before every write', function () {
		withRoot(function (root) {
			const demo = createProfileStorage({ appData: root, userData: root, steamId: USER_A, role: 'demo' });
			const bridge = bridgeFor(demo);
			expect(bridge.getPersistenceMode()).toBe('read-write');
			demo.setItem(ACTIVE_PLAYER_PROFILE_KEY, 'demo-player');
			expect(JSON.parse(readFileSync(savePath(root), 'utf8')).saveOwner).toBe('demo');
			const paid = createProfileStorage({ appData: root, userData: root, steamId: USER_A });
			expect(paid.status()).toBe('ready');
			paid.setItem(ACTIVE_PLAYER_PROFILE_KEY, 'paid-player');
			const original = readFileSync(savePath(root), 'utf8');
			expect(function () { demo.setItem(ACTIVE_PLAYER_PROFILE_KEY, 'stale-demo-player'); }).toThrow();
			expect(bridge.getPersistenceMode()).toBe('read-only');
			expect(demo.getItem(ACTIVE_PLAYER_PROFILE_KEY)).toBe('paid-player');
			expect(readFileSync(savePath(root), 'utf8')).toBe(original);
		});
	});

	test('migration rechecks ownership when a paid save appears after first-run status', function () {
		withRoot(function (root) {
			const demo = createProfileStorage({ appData: root, userData: root, steamId: USER_A, role: 'demo' });
			expect(demo.status()).toBe('migration');
			writeEnvelope(root, { ...futureCompatibleDemo(), saveOwner: 'paid' });
			const original = readFileSync(savePath(root), 'utf8');
			expect(function () { demo.migrate({ [ACTIVE_PLAYER_PROFILE_KEY]: 'legacy' }); }).toThrow();
			expect(demo.status()).toBe('read-only');
			expect(readFileSync(savePath(root), 'utf8')).toBe(original);
		});
	});

	test('failed promotion preserves demo bytes and retries on a later paid launch', function () {
		withRoot(function (root) {
			writeEnvelope(root, futureCompatibleDemo());
			const original = readFileSync(savePath(root), 'utf8');
			const io = { ...fs, renameSync: function () { throw new Error('replacement denied'); } };
			const failed = bridgeFor(createProfileStorage({ appData: root, userData: root, steamId: USER_A, io }));
			expect(function () { failed.getPersistenceMode(); }).toThrow();
			expect(readFileSync(savePath(root), 'utf8')).toBe(original);
			expect(existsSync(`${savePath(root)}.tmp`)).toBe(false);
			expect(createProfileStorage({ appData: root, userData: root, steamId: USER_A }).status()).toBe('ready');
			expect(JSON.parse(readFileSync(savePath(root), 'utf8')).saveOwner).toBe('paid');
		});
	});

	for (const unsupported of [
		{ ...futureCompatibleDemo(), version: 2 },
		{ ...futureCompatibleDemo(), saveOwner: null },
		{ ...futureCompatibleDemo(), saveOwner: 'other' },
		{ ...futureCompatibleDemo(), values: { [PLAYER_PROFILES_KEY]: JSON.stringify({ version: 2, profiles: [] }) } },
	]) {
		test(`preserves unsupported demo files (${JSON.stringify(unsupported).slice(0, 70)})`, function () {
			withRoot(function (root) {
				writeEnvelope(root, unsupported);
				const original = readFileSync(savePath(root), 'utf8');
				for (const role of ['paid', 'demo']) {
					const native = createProfileStorage({ appData: root, userData: root, steamId: USER_A, role });
					expect(function () { native.status(); }).toThrow();
					expect(function () { native.setItem(ACTIVE_PLAYER_PROFILE_KEY, 'replacement'); }).toThrow();
				}
				expect(readFileSync(savePath(root), 'utf8')).toBe(original);
			});
		});
	}

	test('save disappearance after a load blocks stale writes; an initially missing save remains a normal first run', function () {
		withRoot(function (root) {
			const native = createProfileStorage({ appData: root, userData: root, steamId: USER_A });
			expect(native.status()).toBe('migration');
			native.migrate({});
			unlinkSync(savePath(root));
			expect(function () { native.setItem(ACTIVE_PLAYER_PROFILE_KEY, 'stale'); }).toThrow();
			expect(existsSync(savePath(root))).toBe(false);
		});
	});

	test('path is independent of product userData while migration ownership stays local', function () {
		withRoot(function (root) {
			const userData = join(root, 'Some Demo Product');
			const demo = createProfileStorage({ appData: root, userData, steamId: USER_A, role: 'demo' });
			demo.migrate({});
			expect(existsSync(savePath(root))).toBe(true);
			expect(existsSync(join(userData, 'steam-save-migration.json'))).toBe(true);
			expect(existsSync(join(userData, 'steam-saves'))).toBe(false);
		});
	});
});

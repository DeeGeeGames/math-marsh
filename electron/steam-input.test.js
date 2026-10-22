import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { createSteamInput } = createRequire(import.meta.url)('./steam-input.cjs');
const fixture = function () {
	let controllers = [45n];
	let pressed = true;
	let origin = 1;
	let fail = false;
	let glyphPath = '';
	let currentSet = 0n;
	const handles = new Map();
	const calls = [];
	const steam = {
		setSdkPath: function () {},
		init: function () { return true; },
		shutdown: function () { calls.push('shutdown'); },
		runCallbacks: function () { if (fail) throw new Error('sample failed'); },
		input: {
			setInputActionManifestFilePath: function () { return true; },
			init: function () { return true; },
			shutdown: function () { calls.push('input shutdown'); },
			getActionSetHandle: function (name) { return name === 'Menu' ? 1n : 2n; },
			getDigitalActionHandle: function (name) { const handle = BigInt(handles.size + 10); handles.set(name, handle); return handle; },
			runFrame: function () {},
			getConnectedControllers: function () { return controllers; },
			activateActionSet: function (_, handle) { currentSet = handle; calls.push(handle); },
			getCurrentActionSet: function () { return currentSet; },
			getDigitalActionData: function () { return { active: true, state: pressed }; },
			getDigitalActionOrigins: function () { return [origin]; },
			getStringForActionOrigin: function (value) { return `Binding ${value}`; },
			getGlyphPNGForActionOrigin: function () { return glyphPath; },
		},
	};
	return {
		steam, calls, handles,
		options: { environment: { SteamAppId: '4927380' }, loadSteam: function () { return steam; } },
		setControllers: function (value) { controllers = value; },
		setPressed: function (value) { pressed = value; },
		setOrigin: function (value) { origin = value; },
		setGlyph: function (value) { glyphPath = value; },
		fail: function () { fail = true; },
	};
};

describe('desktop native Steam Input', function () {
	test('direct standalone launch never loads Steamworks', function () {
		let loaded = false;
		expect(createSteamInput({ environment: {}, loadSteam: function () { loaded = true; throw new Error('must not load'); } })).toBeNull();
		expect(loaded).toBe(false);
	});

	test('partial initialization failure cleans up without blocking startup', function () {
		const f = fixture();
		f.steam.input.getDigitalActionHandle = function () { return 0n; };
		expect(createSteamInput(f.options)).toBeNull();
		expect(f.calls).toEqual(['input shutdown', 'shutdown']);
	});

	test('samples held/released actions, both sets, changing binding labels, and JSON-safe identities', function () {
		const f = fixture();
		const provider = createSteamInput(f.options);
		const first = provider.sample('menu');
		expect(first[0].kind).toBe('steam');
		expect(first[0].actions.eat).toBe(true);
		expect(first[0].prompts.eat).toEqual([{ label: 'Binding 1' }]);
		expect(provider.sample('menu')[0].actions.eat).toBe(true);
		f.setPressed(false);
		f.setOrigin(2);
		const released = provider.sample('gameplay');
		expect(released[0].actions.eat).toBe(false);
		expect(released[0].prompts.eat).toEqual([{ label: 'Binding 2' }]);
		expect(f.calls).toEqual([1n, 1n, 2n]);
		expect(f.handles.size).toBe(16);
		expect(JSON.parse(JSON.stringify(first))[0].steamHandle).toBe('45');
		provider.dispose();
	});

	test('observed disconnect invalidates ownership identity; failure differs from no controllers', function () {
		const f = fixture();
		const provider = createSteamInput(f.options);
		const initial = provider.sample('menu')[0].id;
		f.setControllers([]);
		expect(provider.sample('menu')).toEqual([]);
		f.setControllers([45n]);
		expect(provider.sample('menu')[0].id).not.toBe(initial);
		f.fail();
		expect(provider.sample('menu')).toBeNull();
		expect(provider.sample('menu')).toBeNull();
		provider.dispose();
		expect(f.calls.filter(function (call) { return call === 'shutdown'; })).toHaveLength(1);
	});

	test('context changes wait through inactive frames and held input until a settled release', function () {
		const f = fixture();
		let active = true;
		let held = true;
		const frameSets = [];
		f.steam.input.runFrame = function () { frameSets.push(f.steam.input.getCurrentActionSet()); };
		f.steam.input.getDigitalActionData = function () { return { active, state: held }; };
		const provider = createSteamInput(f.options);
		const initial = provider.sample('menu')[0];
		expect(initial.actions.eat).toBe(true);
		// Steam has acknowledged the new set but has not produced its active
		// actions. This false data must not count as releasing the held button.
		active = false;
		held = false;
		const transitioning = provider.sample('gameplay')[0];
		expect(transitioning.id).toBe(initial.id);
		expect(Object.values(transitioning.actions).some(Boolean)).toBe(false);
		active = true;
		held = true;
		const heldAfterTransition = provider.sample('gameplay')[0];
		expect(heldAfterTransition.actions.eat).toBe(false);
		expect(heldAfterTransition.actions.skip).toBe(false);
		expect(heldAfterTransition.actions.pause).toBe(false);
		held = false;
		expect(provider.sample('gameplay')[0].actions.eat).toBe(false);
		held = true;
		expect(provider.sample('gameplay')[0].actions.eat).toBe(true);
		// The reverse transition has the same release requirement.
		expect(provider.sample('menu')[0].actions.eat).toBe(false);
		held = false;
		provider.sample('menu');
		held = true;
		expect(provider.sample('menu')[0].actions.eat).toBe(true);
		expect(frameSets.slice(0, 3)).toEqual([1n, 2n, 2n]);
		provider.dispose();
	});

	test('leaves legacy-layout controllers to conventional input independently of native devices', function () {
		const f = fixture();
		f.setControllers([45n, 46n]);
		let nativeLayout = false;
		f.steam.input.getDigitalActionData = function (handle) { return { active: handle === 46n || nativeLayout, state: false }; };
		f.steam.input.getDigitalActionOrigins = function (handle) { return handle === 46n || nativeLayout ? [1] : []; };
		const provider = createSteamInput(f.options);
		try {
			expect(provider.sample('menu').map(controller => controller.steamHandle)).toEqual(['46']);
			expect(provider.sample('menu').map(controller => controller.steamHandle)).toEqual(['46']);
			nativeLayout = true;
			expect(provider.sample('menu').map(controller => controller.steamHandle)).toEqual(['45', '46']);
		} finally { provider.dispose(); }
	});

	test('retains a native route across a short empty action-set update and suppresses its held input', function () {
		const f = fixture();
		let clock = 0;
		let available = true;
		let held = true;
		f.steam.input.getDigitalActionData = function () { return { active: true, state: available && held }; };
		f.steam.input.getDigitalActionOrigins = function () { return available ? [1] : []; };
		const provider = createSteamInput({ ...f.options, now: function () { return clock; } });
		try {
			const initial = provider.sample('menu')[0];
			available = false;
			expect(provider.sample('gameplay')[0].id).toBe(initial.id);
			clock = 200;
			expect(provider.sample('gameplay')[0].actions.eat).toBe(false);
			available = true;
			expect(provider.sample('gameplay')[0].actions.eat).toBe(false);
			held = false;
			provider.sample('gameplay');
			held = true;
			expect(provider.sample('gameplay')[0].actions.eat).toBe(true);
		} finally { provider.dispose(); }
	});

	test('an active action set without any binding origins remains available to conventional input', function () {
		const f = fixture();
		f.steam.input.getDigitalActionData = function () { return { active: true, state: false }; };
		f.steam.input.getDigitalActionOrigins = function () { return []; };
		const provider = createSteamInput(f.options);
		try {
			expect(provider.sample('menu')).toEqual([]);
			expect(provider.sample('gameplay')).toEqual([]);
		} finally { provider.dispose(); }
	});

	test('yields an established native route after persistent empty data and permits later recovery', function () {
		const f = fixture();
		let clock = 0;
		let available = true;
		f.steam.input.getDigitalActionData = function () { return { active: available, state: false }; };
		f.steam.input.getDigitalActionOrigins = function () { return available ? [1] : []; };
		const provider = createSteamInput({ ...f.options, now: function () { return clock; } });
		try {
			const initial = provider.sample('menu')[0];
			available = false;
			provider.sample('gameplay');
			clock = 249;
			expect(provider.sample('gameplay')[0].id).toBe(initial.id);
			clock = 250;
			expect(provider.sample('gameplay')).toEqual([]);
			clock = 500;
			expect(provider.sample('menu')).toEqual([]);
			available = true;
			expect(provider.sample('menu')[0].id).toBe(initial.id);
		} finally { provider.dispose(); }
	});

	test('only bounded PNG content from Steam is returned as a glyph', function () {
		const directory = mkdtempSync(join(tmpdir(), 'math-marsh-steam-glyph-'));
		try {
			const f = fixture();
			const path = join(directory, 'glyph.png');
			writeFileSync(path, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
			f.setGlyph(path);
			const provider = createSteamInput(f.options);
			expect(provider.sample('menu')[0].prompts.eat[0].glyph).toStartWith('data:image/png;base64,');
			const invalid = join(directory, 'invalid.png');
			writeFileSync(invalid, 'not png');
			f.setGlyph(invalid);
			expect(provider.sample('menu')[0].prompts.eat[0].glyph).toBeUndefined();
			const oversized = join(directory, 'large.png');
			writeFileSync(oversized, Buffer.alloc(256 * 1024 + 1));
			f.setGlyph(oversized);
			expect(provider.sample('menu')[0].prompts.eat[0].glyph).toBeUndefined();
			provider.dispose();
		} finally { rmSync(directory, { recursive: true, force: true }); }
	});
});

describe('shared Steam session ownership', function () {
	test('input initialization failure never shuts down an app-owned Steam session', function () {
		const f = fixture();
		f.steam.input.init = function () { return false; };
		let disposed = false;
		const result = createSteamInput({ ...f.options, steamSession: {
			steam: f.steam, dispose: function () { disposed = true; },
		} });
		expect(result).toBeNull();
		expect(disposed).toBe(false);
		expect(f.calls).not.toContain('shutdown');
	});

	test('disposing borrowed input only releases its own subsystem', function () {
		const f = fixture();
		let callbacks = 0;
		f.steam.runCallbacks = function () { callbacks++; };
		const provider = createSteamInput({ ...f.options, steamSession: {
			steam: f.steam, dispose: function () { throw new Error('app owns shutdown'); },
		} });
		provider.sample('menu');
		provider.dispose();
		expect(callbacks).toBe(0);
		expect(f.calls).toContain('input shutdown');
		expect(f.calls).not.toContain('shutdown');
	});

	test('an explicitly unavailable app session never initializes Steam again', function () {
		const f = fixture();
		f.options.loadSteam = function () { throw new Error('must not retry'); };
		expect(createSteamInput({ ...f.options, steamSession: null })).toBeNull();
	});
});

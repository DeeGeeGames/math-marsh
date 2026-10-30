import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';

const { createDesktopInput } = createRequire(import.meta.url)('./desktop-input.cjs');
const ACTIONS = ['up', 'down', 'left', 'right', 'eat', 'back', 'skip', 'pause'];

const steamController = function (handle = '45', id = `steam:${handle}:1`) {
	return { kind: 'steam', id, steamHandle: handle, actions: Object.fromEntries(ACTIONS.map(action => [action, false])), prompts: {} };
};

const conventionalController = function (id, steamHandle = null) {
	const bytes = steamHandle === null ? null : Buffer.alloc(8);
	// Supported desktop targets are little-endian x64; preserve all 64 bits.
	if (bytes) bytes.writeBigUInt64LE(BigInt(steamHandle));
	return {
		device: { id, name: 'Identical Xbox controller' },
		steamHandle: bytes,
		closed: false,
		closeCount: 0,
		buttons: Object.fromEntries([
			'a', 'b', 'x', 'y', 'leftShoulder', 'rightShoulder', 'back', 'start',
			'leftStick', 'rightStick', 'dpadUp', 'dpadDown', 'dpadLeft', 'dpadRight', 'guide',
		].map(name => [name, false])),
		axes: { leftStickX: 0, leftStickY: 0, rightStickX: 0, rightStickY: 0, leftTrigger: 0, rightTrigger: 0 },
		close: function () { this.closed = true; this.closeCount++; },
	};
};

const fixture = function (initialControllers = [], onDiagnostic) {
	let controllers = initialControllers;
	let nativeControllers = [steamController()];
	let nativeError = null;
	let sdlError = null;
	let nativeDisposed = 0;
	const opened = [];
	const contexts = [];
	const errors = [];
	const sdl = { controller: {
		get devices() {
			if (sdlError) throw sdlError;
			return controllers.map(controller => controller.device);
		},
		openDevice: function (device) {
			const controller = controllers.find(controller => controller.device === device);
			if (!controller) throw new Error('Unexpected SDL device');
			opened.push(controller);
			return controller;
		},
	} };
	const provider = createDesktopInput({
		onDiagnostic,
		createSteamInput: function () { return {
			sample: function (context) { contexts.push(context); if (nativeError) throw nativeError; return nativeControllers; },
			dispose: function () { nativeDisposed++; },
		}; },
		loadSdl: function () { return sdl; },
		onError: function (error) { errors.push(error); },
	});
	return {
		provider, opened, contexts, errors,
		setControllers: function (value) { controllers = value; },
		setNative: function (value) { nativeControllers = value; },
		failNative: function (error) { nativeError = error; },
		failSdl: function (error) { sdlError = error; },
		nativeDisposed: function () { return nativeDisposed; },
	};
};

describe('desktop input provider routing', function () {
	test('diagnostics distinguish focus suppression, held input, and the neutral release', function () {
		const conventional = conventionalController(1);
		const reports = [];
		const f = fixture([conventional], function (stage, data) { reports.push({ stage, data }); });
		f.setNative([]);
		try {
			conventional.buttons.a = true;
			expect(f.provider.sample('menu', false).controllers[0].buttons[0].pressed).toBe(false);
			expect(reports.at(-1).data.controllers[0]).toMatchObject({ suppression: 'window-unfocused', input: { pressed: [0] }, output: { pressed: [] } });
			f.provider.sample('menu', true);
			expect(reports.at(-1).data.controllers[0].suppression).toBe('waiting-for-neutral');
			conventional.buttons.a = false;
			f.provider.sample('menu', true);
			expect(reports.at(-1).data.controllers[0].suppression).toBeNull();
			conventional.buttons.a = true;
			expect(f.provider.sample('menu', true).controllers[0].buttons[0].pressed).toBe(true);
		} finally { f.provider.dispose(); }
	});

	test('a broken diagnostic observer cannot disable desktop input', function () {
		const f = fixture([], function () { throw new Error('diagnostic failure'); });
		try { expect(f.provider.sample('menu').available).toBe(true); }
		finally { f.provider.dispose(); }
	});

	test('no native bindings and no SDL devices leave browser controllers available, and native devices can appear later', function () {
		const f = fixture();
		try {
			f.setNative([]);
			expect(f.provider.sample('menu')).toEqual({ available: false, controllers: [] });
			f.setNative([steamController()]);
			expect(f.provider.sample('menu').available).toBe(true);
		} finally { f.provider.dispose(); }
	});
	test('unavailable native input leaves browser fallback available without loading SDL', function () {
		let loaded = false;
		const provider = createDesktopInput({
			createSteamInput: function () { return null; },
			loadSdl: function () { loaded = true; throw new Error('Must not load'); },
		});
		expect(provider.sample('menu')).toEqual({ available: false, controllers: [] });
		expect(loaded).toBe(false);
		provider.dispose();
	});

	test('suppresses only an exact Steam handle, preserving unmatched identical models and independent SDL slots', function () {
		const handle = '18446744073709551614';
		const matching = conventionalController(92, handle);
		const unmatched = conventionalController(0, '1');
		const noHandle = conventionalController(45);
		unmatched.buttons.a = true;
		const f = fixture([unmatched, matching, noHandle]);
		f.setNative([steamController(handle)]);
		try {
			const snapshot = f.provider.sample('gameplay');
			expect(snapshot.available).toBe(true);
			expect(snapshot.controllers.map(controller => controller.id)).toEqual([
				`steam:${handle}:1`, 'sdl:0:Identical Xbox controller', 'sdl:45:Identical Xbox controller',
			]);
			expect(snapshot.controllers[1].buttons[0].pressed).toBe(true);
			expect(f.contexts).toEqual(['gameplay']);
			// Handle metadata can change without model, slot, or device ID changing.
			matching.steamHandle = null;
			expect(f.provider.sample('menu').controllers).toHaveLength(4);
			f.setNative([]);
			expect(f.provider.sample('menu').controllers).toHaveLength(3);
		} finally { f.provider.dispose(); }
		expect([matching.closeCount, unmatched.closeCount, noHandle.closeCount]).toEqual([1, 1, 1]);
	});

	test('SDL loading failure disposes native input and permits fallback', function () {
		let disposed = 0;
		const provider = createDesktopInput({
			createSteamInput: function () { return { dispose: function () { disposed++; } }; },
			loadSdl: function () { throw new Error('SDL unavailable'); },
		});
		expect(provider.sample('menu')).toEqual({ available: false, controllers: [] });
		provider.dispose();
		expect(disposed).toBe(1);
	});

	for (const failure of ['native-throw', 'native-null', 'sdl-throw']) {
		test(`${failure} during sampling releases every opened device and falls back permanently`, function () {
			const first = conventionalController(1);
			const second = conventionalController(2);
			const f = fixture([first, second]);
			expect(f.provider.sample('menu').available).toBe(true);
			const error = new Error(failure);
			if (failure === 'native-throw') f.failNative(error);
			if (failure === 'native-null') f.setNative(null);
			if (failure === 'sdl-throw') f.failSdl(error);
			expect(f.provider.sample('menu')).toEqual({ available: false, controllers: [] });
			expect([first.closeCount, second.closeCount, f.nativeDisposed()]).toEqual([1, 1, 1]);
			expect(f.errors).toEqual(failure === 'native-null' ? [] : [error]);
			expect(f.provider.sample('gameplay').available).toBe(false);
			f.provider.dispose();
			expect(f.nativeDisposed()).toBe(1);
		});
	}

	test('disconnect closes the old device and reconnect exposes a new ownership identity', function () {
		const oldController = conventionalController(7);
		const f = fixture([oldController]);
		f.setNative([]);
		try {
			const initialId = f.provider.sample('menu').controllers[0].id;
			f.setControllers([]);
			expect(f.provider.sample('menu').controllers).toEqual([]);
			expect(oldController.closeCount).toBe(1);
			const replacement = conventionalController(8);
			f.setControllers([replacement]);
			expect(f.provider.sample('menu').controllers[0].id).not.toBe(initialId);
			expect(f.opened).toEqual([oldController, replacement]);
		} finally { f.provider.dispose(); }
	});

	test('focus loss suppresses native and conventional holds until each device is neutral after focus returns', function () {
		const conventional = conventionalController(1);
		const native = steamController();
		const f = fixture([conventional]);
		f.setNative([native]);
		const expectNeutral = function (snapshot) {
			expect(snapshot.controllers[0].actions.eat).toBe(false);
			expect(snapshot.controllers[1].buttons[0].pressed).toBe(false);
			expect(snapshot.controllers[1].axes[0]).toBe(0);
		};
		try {
			native.actions.eat = true;
			conventional.buttons.a = true;
			conventional.axes.leftStickX = 1;
			expect(f.provider.sample('menu').controllers[0].actions.eat).toBe(true);
			expectNeutral(f.provider.sample('menu', false));
			expectNeutral(f.provider.sample('menu', true));
			expectNeutral(f.provider.sample('menu', true));
			native.actions.eat = false;
			expectNeutral(f.provider.sample('menu', true));
			native.actions.eat = true;
			const nativeResumed = f.provider.sample('menu', true);
			expect(nativeResumed.controllers[0].actions.eat).toBe(true);
			expect(nativeResumed.controllers[1].buttons[0].pressed).toBe(false);
			conventional.buttons.a = false;
			conventional.axes.leftStickX = 0;
			f.provider.sample('menu', true);
			conventional.buttons.a = true;
			expect(f.provider.sample('menu', true).controllers[1].buttons[0].pressed).toBe(true);
		} finally { f.provider.dispose(); }
	});
});

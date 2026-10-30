import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const nodeRequire = createRequire(import.meta.url);
const electronDirectory = dirname(fileURLToPath(import.meta.url));
const mainPath = join(electronDirectory, 'main.cjs');
const preloadPath = join(electronDirectory, 'preload.cjs');
const storeUrl = 'https://store.steampowered.com/app/4927380/';

const loadCommonJs = function (file, dependencies, globals = {}) {
	const module = { exports: {} };
	const source = readFileSync(file, 'utf8');
	const context = vm.createContext(globals);
	const load = vm.runInContext(`(function (require, module, exports, __filename, __dirname) { ${source}\n})`, context);
	const moduleRequire = function (specifier) {
		if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
		throw new Error(`Unexpected module dependency: ${specifier}`);
	};
	load(moduleRequire, module, module.exports, file, dirname(file));
	return module.exports;
};

const createBridge = async function (environment = {}) {
	const appListeners = new Map();
	const ipcListeners = new Map();
	const ipcHandlers = new Map();
	const windows = [];
	const clearedTimers = [];
	const externalUrls = [];
	const demoUserDataPaths = [];
	let sdkInitCalls = 0;
	let inputDisposals = 0;
	let platformError = null;
	let markReady;
	const readyPromise = new Promise(resolveReady => { markReady = resolveReady; });

	const app = {
		whenReady: function () { return readyPromise; },
		on: function (eventName, handler) { appListeners.set(eventName, handler); },
		getPath: function (name) { return name === 'appData' ? '/test/app-data' : '/test/user-data'; },
		setPath: function (name, value) { if (name === 'userData') demoUserDataPaths.push(value); },
		requestSingleInstanceLock: function () { return true; },
		quit: function () {},
		isPackaged: false,
	};
	const ipcMain = {
		on: function (channel, handler) { ipcListeners.set(channel, handler); },
		handle: function (channel, handler) { ipcHandlers.set(channel, handler); },
	};
	const shell = {
		openExternal: async function (url) {
			externalUrls.push(url);
			if (platformError) throw platformError;
		},
	};
	const BrowserWindow = class {
		constructor() {
			this.webContents = { send: function () {}, isDestroyed: function () { return false; } };
			this.listeners = new Map();
			windows.push(this);
		}
		loadFile() { return Promise.resolve(); }
		on(eventName, handler) { this.listeners.set(eventName, handler); }
		once(eventName, handler) { this.listeners.set(eventName, handler); }
		isMinimized() { return false; }
		isFocused() { return true; }
		isFullScreen() { return false; }
		setFullScreen() {}
		restore() {}
		focus() {}
		show() {}
		static fromWebContents(sender) { return windows.find(window => window.webContents === sender) ?? null; }
		static getAllWindows() { return windows; }
	};

	const sdk = {
		setSdkPath: function () {},
		init: function () { sdkInitCalls++; return false; },
		shutdown: function () {},
	};
	const steamSession = loadCommonJs(join(electronDirectory, 'steam-session.cjs'), {
		'node:path': nodeRequire('node:path'),
		'steamworks-ffi-node': { SteamworksSDK: { getInstance: function () { return sdk; } } },
	}, {
		process: { env: environment, resourcesPath: '/test/resources' },
	});

	const electron = { app, BrowserWindow, ipcMain, shell };
	const inputProvider = {
		sample: function () { return { available: false, controllers: [] }; },
		dispose: function () { inputDisposals++; },
	};
	const mainProcess = { env: environment, platform: 'linux', resourcesPath: '/test/resources' };
	const mainDependencies = {
		electron,
		'node:path': nodeRequire('node:path'),
		'node:fs': { mkdirSync: function () {} },
		'./desktop-input.cjs': { createDesktopInput: function () { return inputProvider; } },
		'./steam-session.cjs': steamSession,
		'./achievements.cjs': nodeRequire('./achievements.cjs'),
		'./profile-storage.cjs': { createProfileStorage: function () { throw new Error('SDK failure must not create profile storage'); } },
	};
	loadCommonJs(mainPath, mainDependencies, {
		process: mainProcess,
		setInterval: function () { return { unref: function () {} }; },
		clearInterval: function (timer) { clearedTimers.push(timer); },
		console: { error: function () {}, warn: function () {} },
	});
	markReady();
	await Promise.resolve();

	const sender = windows[0].webContents;
	const ipcRenderer = {
		sendSync: function (channel, ...args) {
			const listener = ipcListeners.get(channel);
			if (!listener) throw new Error(`No synchronous handler for ${channel}`);
			const event = { sender, returnValue: undefined };
			listener(event, ...args);
			return event.returnValue;
		},
		invoke: function (channel, ...args) {
			const handler = ipcHandlers.get(channel);
			if (!handler) return Promise.reject(new Error(`No asynchronous handler for ${channel}`));
			return Promise.resolve().then(() => handler({ sender }, ...args));
		},
		on: function (channel, handler) {
			const listeners = ipcListeners.get(channel) ?? [];
			listeners.push(handler);
			ipcListeners.set(channel, listeners);
		},
		send: function () {},
	};
	const contextBridge = {
		exposeInMainWorld: function (name, api) { windowObject[name] = api; },
	};
	const windowObject = { addEventListener: function () {} };
	const preloadDependencies = {
		electron: { contextBridge, ipcRenderer },
		'./profile-storage-bridge.cjs': nodeRequire('./profile-storage-bridge.cjs'),
	};
	loadCommonJs(preloadPath, preloadDependencies, {
		window: windowObject,
		localStorage: { getItem: function () { return null; }, setItem: function () {} },
		performance: { now: function () { return 0; } },
		console: { error: function () {}, warn: function () {} },
	});

	return {
		api: windowObject.mathMarshDesktop,
		sdkInitCalls: function () { return sdkInitCalls; },
		setPlatformError: function (error) { platformError = error; },
		externalUrls,
		demoUserDataPaths,
		cleanup: function () {
			appListeners.get('before-quit')?.();
			return { clearedTimers, inputDisposals };
		},
	};
};

describe('Electron demo bridge integration', function () {
	test('exposes the process role through preload even when Steam SDK initialization fails', async function () {
		for (const scenario of [
			{ appId: '5493870', role: 'demo', initCalls: 1 },
			{ appId: '4927380', role: 'paid', initCalls: 1 },
			{ appId: undefined, role: null, initCalls: 0 },
		]) {
			const environment = scenario.appId ? { SteamAppId: scenario.appId } : {};
			const bridge = await createBridge(environment);
			try {
				expect(bridge.api.steamRole).toBe(scenario.role);
				expect(bridge.sdkInitCalls()).toBe(scenario.initCalls);
				expect(await bridge.api.unlockAchievements([])).toBeUndefined();
				await expect(bridge.api.unlockAchievements(['UNREGISTERED'])).rejects.toThrow('Unregistered achievement');
				if (scenario.role === 'demo') expect(bridge.demoUserDataPaths).toEqual(['/test/app-data/math-marsh-demo']);
			} finally {
				const cleanup = bridge.cleanup();
				expect(cleanup.clearedTimers).toHaveLength(2);
				expect(cleanup.inputDisposals).toBe(1);
			}
		}
	});

	test('opens the fixed full-game store page and propagates platform errors through preload', async function () {
		const bridge = await createBridge({ SteamAppId: '5493870' });
		try {
			expect(await bridge.api.openFullGame()).toBeUndefined();
			expect(bridge.externalUrls).toEqual([storeUrl]);

			const platformError = new Error('external browser unavailable');
			bridge.setPlatformError(platformError);
			let rejection;
			try {
				await bridge.api.openFullGame();
			} catch (error) {
				rejection = error;
			}
			expect(rejection).toBe(platformError);
			expect(bridge.externalUrls).toEqual([storeUrl, storeUrl]);
		} finally {
			const cleanup = bridge.cleanup();
			expect(cleanup.clearedTimers).toHaveLength(2);
			expect(cleanup.inputDisposals).toBe(1);
		}
	});
});

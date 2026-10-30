const { contextBridge, ipcRenderer } = require('electron');
const { createProfileStorageBridge } = require('./profile-storage-bridge.cjs');
const profileStorage = createProfileStorageBridge(
	(operation, ...args) => ipcRenderer.sendSync('desktop:profiles', operation, ...args),
	() => localStorage,
);
const FULLSCREEN_ENABLED_KEY = 'fullscreen-enabled';
let inputSnapshot = { available: false, controllers: [] };
let inputReceivedAt = 0;
const inputDiagnosticsEnabled = typeof process !== 'undefined' && process.env.MATH_MARSH_INPUT_DIAGNOSTICS === '1';
let previousInputDiagnostic;
let inputDiagnosticSentAt = -Infinity;
const receiveInput = function (snapshot) {
	inputSnapshot = snapshot;
	inputReceivedAt = performance.now();
};
ipcRenderer.on('desktop:input-snapshot', (_event, snapshot) => receiveInput(snapshot));
ipcRenderer.invoke('desktop:input-snapshot').then(receiveInput).catch(() => {});

const state = {
	isFullscreenActive: false,
	fullscreenHandlers: new Set(),
	fullscreenSettingLoaded: false,
};

const notifyFullscreenHandlers = () => {
	state.fullscreenHandlers.forEach((handler) => handler());
};

const setFullscreenActive = (isActive) => {
	state.isFullscreenActive = isActive === true;
	if (state.fullscreenSettingLoaded) {
		try {
			localStorage.setItem(FULLSCREEN_ENABLED_KEY, state.isFullscreenActive ? '1' : '0');
		} catch {
			// Storage availability must not prevent native fullscreen changes.
		}
	}
	notifyFullscreenHandlers();
};

ipcRenderer.on('desktop:fullscreen-changed', (_event, isActive) => {
	setFullscreenActive(isActive);
});

window.addEventListener('DOMContentLoaded', async () => {
	try {
		let restoreFullscreen = false;
		try {
			restoreFullscreen = localStorage.getItem(FULLSCREEN_ENABLED_KEY) === '1';
		} catch {
			// Use the current native state when storage is unavailable.
		}
		const active = await ipcRenderer.invoke('desktop:fullscreen-active');
		const restoredActive = restoreFullscreen && !active
			? await ipcRenderer.invoke('desktop:toggle-fullscreen')
			: active;
		setFullscreenActive(restoredActive);
	} catch {
		// Keep any native state already received through fullscreen events.
	} finally {
		state.fullscreenSettingLoaded = true;
	}
}, { once: true });

contextBridge.exposeInMainWorld('mathMarshDesktop', {
	unlockAchievements: names => ipcRenderer.invoke('desktop:achievements', names),
	steamRole: ipcRenderer.sendSync('desktop:steam-role'),
	openFullGame: () => ipcRenderer.invoke('desktop:open-full-game'),
	...(profileStorage ? { profileStorage } : {}),
	input: {
		...(inputDiagnosticsEnabled ? { reportDiagnostics: function (diagnostic) {
			try {
				const serialized = JSON.stringify(diagnostic);
				const at = performance.now();
				if (serialized === previousInputDiagnostic && at - inputDiagnosticSentAt < 1000) return;
				previousInputDiagnostic = serialized;
				inputDiagnosticSentAt = at;
				ipcRenderer.send('desktop:input-diagnostics', {
					...diagnostic,
					bridge: { fresh: at - inputReceivedAt <= 1500, available: inputSnapshot.available },
				});
			} catch { /* Diagnostics cannot interrupt input. */ }
		} } : {}),
		snapshot: () => performance.now() - inputReceivedAt <= 1500
			? inputSnapshot : { available: false, controllers: [] },
		setContext: context => {
			if (context === 'menu' || context === 'gameplay') ipcRenderer.send('desktop:input-context', context);
		},
	},
	fullscreen: {
		isSupported: () => true,
		isActive: () => state.isFullscreenActive,
		toggle: async () => {
			const isActive = await ipcRenderer.invoke('desktop:toggle-fullscreen');
			setFullscreenActive(isActive);
		},
		onChange: (handler) => {
			state.fullscreenHandlers.add(handler);
			return () => {
				state.fullscreenHandlers.delete(handler);
			};
		},
	},
	quit: () => ipcRenderer.invoke('desktop:quit'),
});

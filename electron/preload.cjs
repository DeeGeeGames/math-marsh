const { contextBridge, ipcRenderer } = require('electron');
const FULLSCREEN_ENABLED_KEY = 'fullscreen-enabled';

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

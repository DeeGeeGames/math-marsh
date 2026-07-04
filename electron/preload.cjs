const { contextBridge, ipcRenderer } = require('electron');

const state = {
	isFullscreenActive: false,
	fullscreenHandlers: new Set(),
};

const notifyFullscreenHandlers = () => {
	state.fullscreenHandlers.forEach((handler) => handler());
};

const setFullscreenActive = (isActive) => {
	state.isFullscreenActive = isActive === true;
	notifyFullscreenHandlers();
};

ipcRenderer.on('desktop:fullscreen-changed', (_event, isActive) => {
	setFullscreenActive(isActive);
});

ipcRenderer.invoke('desktop:fullscreen-active')
	.then(setFullscreenActive)
	.catch(() => {
		state.isFullscreenActive = false;
	});

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

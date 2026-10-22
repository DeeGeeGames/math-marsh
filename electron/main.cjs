const { app, BrowserWindow, ipcMain } = require('electron');
const { join } = require('node:path');
const { createDesktopInput } = require('./desktop-input.cjs');

const PROJECT_ROOT = join(__dirname, '..');
const DEV_SERVER_URL = process.env.MATH_MARSH_DEV_SERVER_URL;
let desktopInput;
let inputPoll;
let inputContext = 'menu';

const createWindow = () => {
	const window = new BrowserWindow({
		width: 1920,
		height: 1080,
		minWidth: 1280,
		minHeight: 720,
		backgroundColor: '#07170f',
		title: 'Math Marsh',
		icon: join(PROJECT_ROOT, 'src/assets/icons/math-marsh-icon.png'),
		autoHideMenuBar: true,
		fullscreenable: true,
		show: false,
		webPreferences: {
			preload: join(__dirname, 'preload.cjs'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
	});

	const loadPromise = DEV_SERVER_URL
		? window.loadURL(DEV_SERVER_URL)
		: window.loadFile(join(PROJECT_ROOT, 'dist/index.html'));

	loadPromise.catch((error) => {
		console.error('Failed to load Math Marsh renderer', error);
		app.quit();
	});

	window.once('ready-to-show', () => {
		window.show();
	});

	window.on('enter-full-screen', () => {
		window.webContents.send('desktop:fullscreen-changed', true);
	});
	window.on('leave-full-screen', () => {
		window.webContents.send('desktop:fullscreen-changed', false);
	});

	return window;
};

app.whenReady().then(() => {
	ipcMain.handle('desktop:input-snapshot', (event) => desktopInput?.sample(
		inputContext, BrowserWindow.fromWebContents(event.sender)?.isFocused() ?? false,
	) ?? { available: false, controllers: [] });
	ipcMain.on('desktop:input-context', (_event, context) => {
		if (context === 'menu' || context === 'gameplay') inputContext = context;
	});
	ipcMain.handle('desktop:fullscreen-active', (event) => {
		const window = BrowserWindow.fromWebContents(event.sender);
		return window?.isFullScreen() ?? false;
	});

	ipcMain.handle('desktop:toggle-fullscreen', (event) => {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (!window) return false;
		const isFullscreen = !window.isFullScreen();
		window.setFullScreen(isFullscreen);
		return isFullscreen;
	});

	ipcMain.handle('desktop:quit', () => {
		app.quit();
	});

	createWindow();
	desktopInput = createDesktopInput({
		manifestPath: app.isPackaged
			? join(process.resourcesPath, 'steam-input', 'game_actions.vdf')
			: join(PROJECT_ROOT, 'steam/input/game_actions.vdf'),
		sdkRoot: process.env.MATH_MARSH_STEAM_SDK_ROOT ?? (app.isPackaged
			? join(process.resourcesPath, 'steamworks_sdk') : join(PROJECT_ROOT, 'steamworks_sdk')),
		onError: error => console.warn('Native controller provider unavailable; using browser gamepads.', error),
	});
	inputPoll = setInterval(() => {
		const windows = BrowserWindow.getAllWindows();
		const snapshot = desktopInput.sample(inputContext, windows.some(window => window.isFocused()));
		for (const window of windows) {
			if (!window.webContents.isDestroyed()) window.webContents.send('desktop:input-snapshot', snapshot);
		}
	}, 16);
	inputPoll.unref();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length > 0) return;
		createWindow();
	});
});

app.on('before-quit', () => {
	clearInterval(inputPoll);
	desktopInput?.dispose();
});

app.on('window-all-closed', () => {
	if (process.platform === 'darwin') return;
	app.quit();
});

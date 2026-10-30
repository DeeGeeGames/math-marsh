const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { join } = require('node:path');
const { mkdirSync } = require('node:fs');
const { createDesktopInput } = require('./desktop-input.cjs');
const { createSteamSession, isSteamLaunch, getSteamAppIdentity } = require('./steam-session.cjs');
const { createProfileStorage } = require('./profile-storage.cjs');

const { createAchievementQueue } = require('./achievements.cjs');

const PROJECT_ROOT = join(__dirname, '..');
const DEV_SERVER_URL = process.env.MATH_MARSH_DEV_SERVER_URL;
let desktopInput;
let inputPoll;
let inputContext = 'menu';
let steamSession;
let achievementQueue;
let achievementPoll;

const steamIdentity = getSteamAppIdentity();
if (steamIdentity?.role === 'demo') {
	const demoUserData = join(app.getPath('appData'), 'math-marsh-demo');
	mkdirSync(demoUserData, { recursive: true });
	app.setPath('userData', demoUserData);
}

// One writer per userData directory, including atomic-save temporary files.
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
app.on('second-instance', () => {
	const window = BrowserWindow.getAllWindows()[0];
	if (!window) return;
	if (window.isMinimized()) window.restore();
	window.focus();
});

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
	if (!ownsInstance) return;
	const steamOptions = {
		sdkRoot: process.env.MATH_MARSH_STEAM_SDK_ROOT ?? (app.isPackaged
			? join(process.resourcesPath, 'steamworks_sdk') : join(PROJECT_ROOT, 'steamworks_sdk')),
		onError: error => console.warn('Steamworks unavailable.', error),
	};
	steamSession = createSteamSession(steamOptions);
	achievementQueue = createAchievementQueue(steamSession);
	ipcMain.handle('desktop:achievements', (event, names) => {
		if (!BrowserWindow.fromWebContents(event.sender)) throw new Error('Unknown achievement caller');
		achievementQueue.submit(names);
	});
	// StoreStats can be rate limited. Retry on a minute cadence, outside play.
	achievementPoll = setInterval(() => { void achievementQueue.flush(); }, 60_000);
	achievementPoll.unref();
	let profileStorage;
	try {
		if (steamSession) profileStorage = createProfileStorage({
			appData: app.getPath('appData'),
			userData: steamSession.role === 'demo' ? app.getPath('userData') : join(app.getPath('appData'), 'math-marsh'),
			steamId: steamSession.steam.getStatus().steamId, role: steamSession.role,
		});
	} catch (error) { console.warn('Steam profile storage unavailable.', error); }
	ipcMain.on('desktop:steam-role', (event) => {
		event.returnValue = BrowserWindow.fromWebContents(event.sender) ? steamIdentity?.role ?? null : null;
	});
	ipcMain.handle('desktop:open-full-game', async (event) => {
		if (!BrowserWindow.fromWebContents(event.sender)) throw new Error('Unknown full-game caller');
		await shell.openExternal('https://store.steampowered.com/app/4927380/');
	});
	ipcMain.on('desktop:profiles', (event, operation, ...args) => {
		try {
			if (!BrowserWindow.fromWebContents(event.sender)) throw new Error('Unknown profile storage caller');
			if (!isSteamLaunch()) {
				if (operation !== 'status') throw new Error('Not a Steam launch');
				event.returnValue = { ok: true, value: 'standalone' };
				return;
			}
			if (!profileStorage) throw new Error('Steam profile storage unavailable');
			let value;
			if (operation === 'status') value = profileStorage.status();
			else if (operation === 'migrate') profileStorage.migrate(args[0]);
			else if (operation === 'get') value = profileStorage.getItem(args[0]);
			else if (operation === 'set') profileStorage.setItem(args[0], args[1]);
			else throw new Error('Unknown profile storage operation');
			event.returnValue = { ok: true, value };
		} catch (error) {
			console.warn('Steam profile operation failed.', error);
			event.returnValue = { ok: false };
		}
	});
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
		steamSession,
		manifestPath: app.isPackaged
			? join(process.resourcesPath, 'steam-input', 'game_actions.vdf')
			: join(PROJECT_ROOT, 'steam/input/game_actions.vdf'),
		sdkRoot: process.env.MATH_MARSH_STEAM_SDK_ROOT ?? (app.isPackaged
			? join(process.resourcesPath, 'steamworks_sdk') : join(PROJECT_ROOT, 'steamworks_sdk')),
		onError: error => console.warn('Native controller provider unavailable; using browser gamepads.', error),
	});
	inputPoll = setInterval(() => {
		try { steamSession?.steam.runCallbacks(); } catch (error) { console.warn('Steam callback failed.', error); }
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
	clearInterval(achievementPoll);
	achievementQueue?.dispose();
	desktopInput?.dispose();
	steamSession?.dispose();
});

app.on('window-all-closed', () => {
	if (process.platform === 'darwin') return;
	app.quit();
});

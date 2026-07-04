const { app, BrowserWindow, ipcMain } = require('electron');
const { join } = require('node:path');

const PROJECT_ROOT = join(__dirname, '..');
const DEV_SERVER_URL = process.env.MATH_MARSH_DEV_SERVER_URL;

const createWindow = () => {
	const window = new BrowserWindow({
		width: 1920,
		height: 1080,
		minWidth: 1280,
		minHeight: 720,
		backgroundColor: '#07170f',
		title: 'Math Marsh',
		icon: join(PROJECT_ROOT, 'src/assets/images/math-marsh-icon.png'),
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

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length > 0) return;
		createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform === 'darwin') return;
	app.quit();
});

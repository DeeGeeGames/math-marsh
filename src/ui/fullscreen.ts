import { getDesktopFullscreenController } from '../platform/desktop';

// iOS Safari on iPhone doesn't implement requestFullscreen; callers should
// hide their UI when isFullscreenSupported() returns false.
export const isFullscreenSupported = (): boolean =>
	getDesktopFullscreenController() !== undefined
	|| typeof document.documentElement.requestFullscreen === 'function';

export const isFullscreenActive = (): boolean =>
	getDesktopFullscreenController()?.isActive() ?? document.fullscreenElement !== null;

export const toggleFullscreen = async (): Promise<void> => {
	const desktopFullscreen = getDesktopFullscreenController();
	if (desktopFullscreen) {
		await desktopFullscreen.toggle();
		return;
	}
	if (isFullscreenActive()) {
		await document.exitFullscreen();
		return;
	}
	await document.documentElement.requestFullscreen();
};

export const onFullscreenChange = (handler: () => void): (() => void) => {
	const desktopFullscreen = getDesktopFullscreenController();
	if (desktopFullscreen) return desktopFullscreen.onChange(handler);
	document.addEventListener('fullscreenchange', handler);
	return () => document.removeEventListener('fullscreenchange', handler);
};

export type DesktopFullscreenController = {
	isSupported: () => boolean;
	isActive: () => boolean;
	toggle: () => Promise<void>;
	onChange: (handler: () => void) => () => void;
};

export type DesktopPlatform = {
	fullscreen?: DesktopFullscreenController;
	quit?: () => Promise<void>;
};

declare global {
	interface Window {
		mathMarshDesktop?: DesktopPlatform;
	}
}

function getDesktopPlatform(): DesktopPlatform | undefined {
	return window.mathMarshDesktop;
}

export function getDesktopFullscreenController(): DesktopFullscreenController | undefined {
	const controller = getDesktopPlatform()?.fullscreen;
	if (!controller?.isSupported()) return undefined;
	return controller;
}

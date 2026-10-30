import type { ProfileStorage } from '../profiles/persistence';
import type { GameAction } from '../ecs/types';

export type DesktopFullscreenController = {
	isSupported: () => boolean;
	isActive: () => boolean;
	toggle: () => Promise<void>;
	onChange: (handler: () => void) => () => void;
};

export type DesktopController = {
	kind: 'steam';
	id: string;
	steamHandle: string;
	actions: Readonly<Record<GameAction, boolean>>;
	prompts: Partial<Record<GameAction, readonly { label: string; glyph?: string }[]>>;
} | {
	kind: 'gamepad';
	id: string;
	buttons: readonly { pressed: boolean; value: number }[];
	axes: readonly number[];
};

export type DesktopInputSnapshot = {
	available: boolean;
	controllers: readonly DesktopController[];
};

export type DesktopInputController = {
	snapshot: () => DesktopInputSnapshot;
	setContext: (context: 'menu' | 'gameplay') => void;
	reportDiagnostics?: (diagnostic: RendererInputDiagnostic) => void;
};

export type RendererInputDiagnostic = {
	screen: string | null;
	ownerId: string | null;
	ownerSlot: number | null;
	waitingForNeutral: boolean;
	blockFrame: boolean;
	pageFocused: boolean;
	pageHidden: boolean;
	controllers: readonly {
		slot: number;
		id: string | null;
		connected: boolean;
		pressed: readonly number[];
		axes: readonly number[];
	}[];
	activeActions: readonly GameAction[];
};

export type SteamAppRole = 'demo' | 'paid' | null;

export type DesktopPlatform = {
	unlockAchievements?: (names: readonly string[]) => Promise<void>;
	steamRole?: SteamAppRole;
	openFullGame?: () => Promise<void>;
	profileStorage?: ProfileStorage;
	input?: DesktopInputController;
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

export function getDesktopQuitHandler(): DesktopPlatform['quit'] {
	return getDesktopPlatform()?.quit;
}

export const getDesktopInputController = function (): DesktopInputController | undefined {
	return typeof window === 'undefined' ? undefined : getDesktopPlatform()?.input;
};

export const getDesktopSteamRole = function(): SteamAppRole {
	const role = typeof window === 'undefined' ? null : getDesktopPlatform()?.steamRole;
	return role === 'demo' || role === 'paid' ? role : null;
};

export const openDesktopFullGame = async function(): Promise<void> {
	const open = typeof window === 'undefined' ? undefined : getDesktopPlatform()?.openFullGame;
	if (!open) throw new Error('Desktop store link unavailable');
	await open();
};

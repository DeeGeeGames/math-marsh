// Touch buttons drive the existing ECSpresso keyboard-action pipeline.
const INITIAL_REPEAT_DELAY_MS = 250;
const REPEAT_INTERVAL_MS = 150;

const ACTION_KEYS = {
	up: 'ArrowUp',
	down: 'ArrowDown',
	left: 'ArrowLeft',
	right: 'ArrowRight',
	eat: ' ',
	pause: 'Escape',
} as const;

type TouchAction = keyof typeof ACTION_KEYS;

const dispatchKey = (type: 'keydown' | 'keyup', key: string): void => {
	window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
};

type BindOptions = { repeat: boolean };

const bindButton = (button: HTMLButtonElement, action: TouchAction, options: BindOptions, activeReleases: Set<() => void>): (() => void) => {
	const key = ACTION_KEYS[action];
	let timers: { initial: number | null; interval: number | null } = { initial: null, interval: null };

	const clearTimers = (): void => {
		if (timers.initial !== null) window.clearTimeout(timers.initial);
		if (timers.interval !== null) window.clearInterval(timers.interval);
		timers = { initial: null, interval: null };
	};

	const release = (): void => {
		clearTimers();
		activeReleases.delete(release);
		dispatchKey('keyup', key);
	};

	const onPointerDown = function(event: PointerEvent): void {
		event.preventDefault();
		button.setPointerCapture(event.pointerId);
		activeReleases.add(release);
		dispatchKey('keydown', key);
		if (!options.repeat) return;
		timers.initial = window.setTimeout(() => {
			dispatchKey('keydown', key);
			timers.interval = window.setInterval(() => dispatchKey('keydown', key), REPEAT_INTERVAL_MS);
		}, INITIAL_REPEAT_DELAY_MS);
	};
	const onPointerUp = function(event: PointerEvent): void {
		event.preventDefault();
		release();
	};
	button.addEventListener('pointerdown', onPointerDown);
	button.addEventListener('pointerup', onPointerUp);
	button.addEventListener('pointercancel', release);
	button.addEventListener('lostpointercapture', release);
	return function(): void {
		if (activeReleases.has(release)) release();
		clearTimers();
		button.removeEventListener('pointerdown', onPointerDown);
		button.removeEventListener('pointerup', onPointerUp);
		button.removeEventListener('pointercancel', release);
		button.removeEventListener('lostpointercapture', release);
	};
};

const findButton = (root: ParentNode, id: string): HTMLButtonElement => {
	const el = root.querySelector<HTMLButtonElement>(`#${id}`);
	if (!el) throw new Error(`Touch control button not found: #${id}`);
	return el;
};

export const bindTouchControls = (root: ParentNode): (() => void) => {
	const activeReleases = new Set<() => void>();
	const onVisibilityChange = function(): void {
		if (document.visibilityState === 'hidden') activeReleases.forEach(function(release) { release(); });
	};
	document.addEventListener('visibilitychange', onVisibilityChange);
	const cleanups = (['up', 'down', 'left', 'right', 'eat'] as const).map(function(action) {
		return bindButton(findButton(root, `touch-${action}`), action, { repeat: action !== 'eat' }, activeReleases);
	});
	return function(): void {
		document.removeEventListener('visibilitychange', onVisibilityChange);
		cleanups.forEach(function(cleanup) { cleanup(); });
	};
};

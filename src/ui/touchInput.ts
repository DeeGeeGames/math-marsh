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

// Single module-scope visibilitychange listener that fans out to whichever
// buttons are currently pressed — registering one per button leaked listeners
// every time the playing screen was re-mounted.
const activeReleases = new Set<() => void>();
document.addEventListener('visibilitychange', () => {
	if (document.visibilityState !== 'hidden') return;
	activeReleases.forEach((r) => r());
});

type BindOptions = { repeat: boolean };

const bindButton = (button: HTMLButtonElement, action: TouchAction, options: BindOptions): void => {
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

	button.addEventListener('pointerdown', (event) => {
		event.preventDefault();
		button.setPointerCapture(event.pointerId);
		activeReleases.add(release);
		dispatchKey('keydown', key);
		if (!options.repeat) return;
		timers.initial = window.setTimeout(() => {
			dispatchKey('keydown', key);
			timers.interval = window.setInterval(() => dispatchKey('keydown', key), REPEAT_INTERVAL_MS);
		}, INITIAL_REPEAT_DELAY_MS);
	});
	button.addEventListener('pointerup', (event) => {
		event.preventDefault();
		release();
	});
	button.addEventListener('pointercancel', release);
	button.addEventListener('lostpointercapture', release);
};

const findButton = (root: ParentNode, id: string): HTMLButtonElement => {
	const el = root.querySelector<HTMLButtonElement>(`#${id}`);
	if (!el) throw new Error(`Touch control button not found: #${id}`);
	return el;
};

export const bindTouchControls = (root: ParentNode): void => {
	bindButton(findButton(root, 'touch-up'), 'up', { repeat: true });
	bindButton(findButton(root, 'touch-down'), 'down', { repeat: true });
	bindButton(findButton(root, 'touch-left'), 'left', { repeat: true });
	bindButton(findButton(root, 'touch-right'), 'right', { repeat: true });
	// Eat: keydown on pointerdown, keyup on pointerup. The two events must
	// straddle a frame so the input plugin's per-frame poll observes the edge.
	bindButton(findButton(root, 'touch-eat'), 'eat', { repeat: false });
};

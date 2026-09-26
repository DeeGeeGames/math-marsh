// CSS owns spacing and reserved control regions; this adapter measures the
// rendered canvas and fits the controls into the available space.
const px = (value: number): string => `${Math.max(0, Math.floor(value))}px`;

const setStyleValue = (root: HTMLElement, name: string, value: number): void => {
	root.style.setProperty(name, px(value));
};

const availableSize = (...values: number[]): number =>
	Math.max(0, Math.min(...values));

function spacing(style: CSSStyleDeclaration, property: string): number {
	const value = Number.parseFloat(style.getPropertyValue(property));
	if (!Number.isFinite(value)) throw new Error(`Missing touch layout spacing: ${property}`);
	return value;
}

const canvasRect = (): DOMRect | null => {
	const canvas = document.getElementById('game-canvas');
	if (!(canvas instanceof HTMLCanvasElement)) return null;
	return canvas.getBoundingClientRect();
};

export const updateTouchControlsLayout = (): void => {
	const root = document.getElementById('gameplay-ui');
	const rect = canvasRect();
	if (!root || !rect) return;

	const style = getComputedStyle(root);
	const edgeGap = spacing(style, '--touch-edge-gap');
	const controlGap = spacing(style, '--touch-control-gap');
	const isPortrait = window.matchMedia('(orientation: portrait)').matches;
	const dpadAvailable = isPortrait
		? availableSize(window.innerWidth / 2 - edgeGap * 2, window.innerHeight - rect.bottom - edgeGap * 2)
		: availableSize(rect.left - edgeGap * 2, window.innerHeight - edgeGap * 2);
	const actionAvailable = isPortrait
		? dpadAvailable
		: availableSize(window.innerWidth - rect.right - edgeGap * 2, window.innerHeight - edgeGap * 2);

	setStyleValue(root, '--touch-dpad-cluster-size', dpadAvailable);
	setStyleValue(root, '--touch-dpad-button-size', Math.max(0, (dpadAvailable - controlGap * 2) / 3));
	setStyleValue(root, '--touch-action-size', actionAvailable);
	setStyleValue(root, '--touch-eat-size', actionAvailable);
};

let layoutFrame: number | null = null;

export const scheduleTouchControlsLayout = (): void => {
	if (layoutFrame !== null) return;
	layoutFrame = window.requestAnimationFrame(() => {
		layoutFrame = null;
		updateTouchControlsLayout();
	});
};

window.addEventListener('resize', scheduleTouchControlsLayout);
window.addEventListener('orientationchange', scheduleTouchControlsLayout);
window.addEventListener('math-marsh:canvas-resize', scheduleTouchControlsLayout);


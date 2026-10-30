// CSS owns spacing and reserved control regions; this adapter measures the
// rendered canvas and fits the controls into the available space.
const px = (value: number): string => `${Math.max(0, Math.floor(value))}px`;

const setStyleValue = (root: HTMLElement, name: string, value: number): void => {
	root.style.setProperty(name, px(value));
};

const availableSize = (...values: number[]): number =>
	Math.max(0, Math.min(...values));

type TouchLayoutArea = Readonly<{
	width: number;
	height: number;
	canvasLeft: number;
	canvasRight: number;
	canvasBottom: number;
	edgeGap: number;
	safeTop: number;
	safeRight: number;
	safeBottom: number;
	safeLeft: number;
}>;

// Use the same computed safe-area values as the CSS rails and button offsets.
// Measuring only the viewport overestimates the available space beside a notch.
export const touchControlLayout = function(area: TouchLayoutArea): Readonly<{
	dpadSize: number;
	actionSize: number;
	dpadTop: number;
	actionTop: number;
}> {
	const left = Math.max(area.edgeGap, area.safeLeft);
	const right = Math.max(area.edgeGap, area.safeRight);
	const top = Math.max(area.edgeGap, area.safeTop);
	const bottom = area.height - Math.max(area.edgeGap, area.safeBottom);
	const portrait = area.height >= area.width;
	const controlTop = portrait ? area.canvasBottom + area.edgeGap : top;
	const availableHeight = Math.max(0, bottom - controlTop);
	const dpadSize = portrait
		? availableSize(area.width / 2 - left - area.edgeGap, availableHeight)
		: availableSize(area.canvasLeft - left - area.edgeGap, availableHeight, 220);
	const actionSize = portrait
		? availableSize(area.width / 2 - right - area.edgeGap, availableHeight)
		: availableSize(area.width - area.canvasRight - right - area.edgeGap, availableHeight, 220);
	return {
		dpadSize,
		actionSize,
		dpadTop: controlTop + (availableHeight - dpadSize) / 2,
		actionTop: controlTop + (availableHeight - actionSize) / 2,
	};
};

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
	const { dpadSize, actionSize, dpadTop, actionTop } = touchControlLayout({
		width: window.innerWidth,
		height: window.innerHeight,
		canvasLeft: rect.left,
		canvasRight: rect.right,
		canvasBottom: rect.bottom,
		edgeGap,
		safeTop: spacing(style, '--touch-safe-top'),
		safeRight: spacing(style, '--touch-safe-right'),
		safeBottom: spacing(style, '--touch-safe-bottom'),
		safeLeft: spacing(style, '--touch-safe-left'),
	});

	setStyleValue(root, '--touch-dpad-cluster-size', dpadSize);
	setStyleValue(root, '--touch-dpad-button-size', Math.max(0, (dpadSize - controlGap * 2) / 3));
	setStyleValue(root, '--touch-action-size', actionSize);
	setStyleValue(root, '--touch-eat-size', actionSize);
	setStyleValue(root, '--touch-portrait-top', dpadTop);
	setStyleValue(root, '--touch-dpad-top', dpadTop);
	setStyleValue(root, '--touch-action-top', actionTop);
};

let layoutFrame: number | null = null;

export const scheduleTouchControlsLayout = (): void => {
	if (layoutFrame !== null) return;
	layoutFrame = window.requestAnimationFrame(() => {
		layoutFrame = null;
		updateTouchControlsLayout();
	});
};

export const initializeTouchControlsLayout = function(): () => void {
  window.addEventListener('resize', scheduleTouchControlsLayout);
  window.addEventListener('orientationchange', scheduleTouchControlsLayout);
  window.addEventListener('math-marsh:canvas-resize', scheduleTouchControlsLayout);
  return function(): void {
    window.removeEventListener('resize', scheduleTouchControlsLayout);
    window.removeEventListener('orientationchange', scheduleTouchControlsLayout);
    window.removeEventListener('math-marsh:canvas-resize', scheduleTouchControlsLayout);
    if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
    layoutFrame = null;
  };
};

import { GAME_CONFIG } from '../../../config';

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let observer: ResizeObserver | null = null;
let observedTarget: Element | null = null;

export type RenderMargins = {
	top: number;
	right: number;
	bottom: number;
	left: number;
};

const marginPixels = (ratio: number): number =>
	Math.ceil(GAME_CONFIG.GRID.CELL_SIZE * ratio);

export const renderMargins = (): RenderMargins => ({
	top: marginPixels(GAME_CONFIG.RENDER.PLAY_AREA_TOP_MARGIN_RATIO),
	right: marginPixels(GAME_CONFIG.RENDER.PLAY_AREA_SIDE_MARGIN_RATIO),
	bottom: marginPixels(GAME_CONFIG.RENDER.PLAY_AREA_BOTTOM_MARGIN_RATIO),
	left: marginPixels(GAME_CONFIG.RENDER.PLAY_AREA_SIDE_MARGIN_RATIO),
});

const canvasPixelSize = (): { width: number; height: number } => {
	const margins = renderMargins();
	const gridWidth = GAME_CONFIG.GRID.WIDTH * GAME_CONFIG.GRID.CELL_SIZE;
	const gridHeight = GAME_CONFIG.GRID.HEIGHT * GAME_CONFIG.GRID.CELL_SIZE;
	return {
		width: gridWidth + margins.left + margins.right,
		height: gridHeight + margins.top + margins.bottom,
	};
};

function isDesktopViewport(): boolean {
	return window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 769px)').matches;
}

function canvasDisplayBounds(container: Element | null): { width: number; height: number; maxScale: number } {
	const isDesktop = isDesktopViewport();
	const width = container?.clientWidth ?? window.innerWidth;
	const height = container?.clientHeight ?? window.innerHeight;
	const margin = isDesktop ? GAME_CONFIG.RENDER.DESKTOP_CANVAS_MARGIN_PX : 0;
	return {
		width: Math.max(0, width - margin * 2),
		height: Math.max(0, height - margin * 2),
		maxScale: isDesktop ? Number.POSITIVE_INFINITY : 1,
	};
}

const resizeCanvas = (): void => {
	if (!canvas) return;

	const gameSize = canvasPixelSize();

	// #canvas-container is a flex-1 region behind the floating top HUD and above
	// the bottom hints / on-screen touch controls. Sizing against its rect
	// makes the canvas grow into space the surrounding chrome leaves behind.
	const container = canvas.parentElement;
	const bounds = canvasDisplayBounds(container);

	const scale = Math.min(bounds.width / gameSize.width, bounds.height / gameSize.height, bounds.maxScale);

	canvas.width = gameSize.width;
	canvas.height = gameSize.height;

	canvas.style.width = `${gameSize.width * scale}px`;
	canvas.style.height = `${gameSize.height * scale}px`;

	if (ctx) {
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.imageSmoothingEnabled = false;
	}

	window.dispatchEvent(new Event('math-marsh:canvas-resize'));
};

// ResizeObserver fires after the browser has committed the new layout, so the
// container's reported rect is always current. `orientationchange` / `resize`
// fire too early on some browsers and can leave the canvas sized against a
// stale rect — observing the container directly avoids that.
const observeContainer = (target: Element): void => {
	if (typeof ResizeObserver === 'undefined') return;
	if (observer && observedTarget === target) return;
	observer?.disconnect();
	observer = new ResizeObserver(() => resizeCanvas());
	observer.observe(target);
	observedTarget = target;
};

export const initializeRenderSystem = (canvasElement: HTMLCanvasElement): void => {
	const isFirstInit = canvas === null;

	canvas = canvasElement;
	ctx = canvas.getContext('2d');

	if (!ctx) throw new Error('Failed to get 2D rendering context');

	resizeCanvas();

	const container = canvas.parentElement;
	if (container) observeContainer(container);

	if (isFirstInit) {
		// Belt-and-suspenders fallback for environments without ResizeObserver.
		window.addEventListener('resize', resizeCanvas);
	}
};

export const cleanupRenderSystem = (): void => {
	window.removeEventListener('resize', resizeCanvas);
	observer?.disconnect();
	observer = null;
	observedTarget = null;
};

export const getCtx = (): CanvasRenderingContext2D | null => ctx;

// Called from UIManager when overlay chrome (touch controls, HUD visibility)
// changes the available area without firing a window resize event.
export const requestCanvasResize = (): void => resizeCanvas();

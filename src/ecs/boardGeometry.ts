import { GAME_CONFIG } from '../config';

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

export const canvasPixelSize = (): { width: number; height: number } => {
	const margins = renderMargins();
	const gridWidth = GAME_CONFIG.GRID.WIDTH * GAME_CONFIG.GRID.CELL_SIZE;
	const gridHeight = GAME_CONFIG.GRID.HEIGHT * GAME_CONFIG.GRID.CELL_SIZE;
	return {
		width: gridWidth + margins.left + margins.right,
		height: gridHeight + margins.top + margins.bottom,
	};
};


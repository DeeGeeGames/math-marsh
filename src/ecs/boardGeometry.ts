import { GAME_CONFIG } from '../config';
import type { MathDifficulty } from './types';

export type BoardSize = Readonly<{ width: number; height: number }>;

export const BOARD_SIZES = {
	easy: { width: 3, height: 3 },
	medium: { width: 5, height: 4 },
	expert: { width: 6, height: 5 },
} as const satisfies Readonly<Record<MathDifficulty, BoardSize>>;

export const TUTORIAL_BOARD = { width: 6, height: 5 } as const satisfies BoardSize;

export function boardForDifficulty(difficulty: MathDifficulty): BoardSize {
	return BOARD_SIZES[difficulty];
}

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

export const canvasPixelSize = (board: BoardSize): { width: number; height: number } => {
	const margins = renderMargins();
	const gridWidth = board.width * GAME_CONFIG.GRID.CELL_SIZE;
	const gridHeight = board.height * GAME_CONFIG.GRID.CELL_SIZE;
	return {
		width: gridWidth + margins.left + margins.right,
		height: gridHeight + margins.top + margins.bottom,
	};
};


import { describe, expect, test } from 'bun:test';
import { BOARD_SIZES, canvasPixelSize, renderMargins } from './boardGeometry';
import { GAME_CONFIG } from '../config';
import { gridCells, boardPointGridCell } from './lilyPads';
import { canContinueFrom, updateBreadcrumbs } from './movementIntent';
import { boardPointAtCanvasPixel } from '../ui/boardPointer';

describe('difficulty board geometry', () => {
	Object.entries(BOARD_SIZES).forEach(([difficulty, board]) => {
		test(`${difficulty} keeps rendering, pointer input and directional movement within its own bounds`, () => {
			const cell = GAME_CONFIG.GRID.CELL_SIZE;
			const margins = renderMargins();
			const size = canvasPixelSize(board);
			const corner = { x: board.width - 1, y: board.height - 1 };
			expect(gridCells(board)).toHaveLength(board.width * board.height);
			expect(size.width).toBe(board.width * cell + margins.left + margins.right);
			expect(size.height).toBe(board.height * cell + margins.top + margins.bottom);
			expect(boardPointAtCanvasPixel(margins.left + board.width * cell, margins.top + board.height * cell, board))
				.toEqual({ x: board.width * cell, y: board.height * cell });
			expect(boardPointAtCanvasPixel(margins.left + board.width * cell + 1, margins.top + cell, board)).toBeNull();
			expect(boardPointGridCell({ x: board.width * cell, y: board.height * cell }, board)).toEqual(corner);
			expect(canContinueFrom(corner, 'right', board)).toBe(false);
			expect(canContinueFrom(corner, 'down', board)).toBe(false);
			expect(updateBreadcrumbs({ anchorGridX: corner.x, anchorGridY: corner.y, breadcrumbs: [], speed: 0 }, 'right', board))
				.toEqual([]);
		});
	});
});

import { describe, expect, test } from 'bun:test';
import { GAME_CONFIG } from '../config';
import { BOARD_SIZES, renderMargins } from '../ecs/boardGeometry';
import { boardPointAtCanvasPixel } from './boardPointer';

describe('board pointer area', () => {
  test('includes gaps and the full edge of the pond grid', () => {
    const margins = renderMargins();
    expect(boardPointAtCanvasPixel(margins.left + GAME_CONFIG.GRID.CELL_SIZE, margins.top + 53, BOARD_SIZES.expert))
      .toEqual({ x: GAME_CONFIG.GRID.CELL_SIZE, y: 53 });
    expect(boardPointAtCanvasPixel(
      margins.left + BOARD_SIZES.expert.width * GAME_CONFIG.GRID.CELL_SIZE,
      margins.top + BOARD_SIZES.expert.height * GAME_CONFIG.GRID.CELL_SIZE,
      BOARD_SIZES.expert,
    )).toEqual({
      x: BOARD_SIZES.expert.width * GAME_CONFIG.GRID.CELL_SIZE,
      y: BOARD_SIZES.expert.height * GAME_CONFIG.GRID.CELL_SIZE,
    });
  });

  test('keeps the objective and decorative margins outside the hit area', () => {
    const margins = renderMargins();
    expect(boardPointAtCanvasPixel(margins.left + 53, margins.top - 1, BOARD_SIZES.expert)).toBeNull();
    expect(boardPointAtCanvasPixel(margins.left - 1, margins.top + 53, BOARD_SIZES.expert)).toBeNull();
  });
});

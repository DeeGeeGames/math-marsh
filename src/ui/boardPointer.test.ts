import { describe, expect, test } from 'bun:test';
import { GAME_CONFIG } from '../config';
import { renderMargins } from '../ecs/boardGeometry';
import { boardPointAtCanvasPixel } from './boardPointer';

describe('board pointer area', () => {
  test('includes gaps and the full edge of the pond grid', () => {
    const margins = renderMargins();
    expect(boardPointAtCanvasPixel(margins.left + GAME_CONFIG.GRID.CELL_SIZE, margins.top + 53))
      .toEqual({ x: GAME_CONFIG.GRID.CELL_SIZE, y: 53 });
    expect(boardPointAtCanvasPixel(
      margins.left + GAME_CONFIG.GRID.WIDTH * GAME_CONFIG.GRID.CELL_SIZE,
      margins.top + GAME_CONFIG.GRID.HEIGHT * GAME_CONFIG.GRID.CELL_SIZE,
    )).toEqual({
      x: GAME_CONFIG.GRID.WIDTH * GAME_CONFIG.GRID.CELL_SIZE,
      y: GAME_CONFIG.GRID.HEIGHT * GAME_CONFIG.GRID.CELL_SIZE,
    });
  });

  test('keeps the objective and decorative margins outside the hit area', () => {
    const margins = renderMargins();
    expect(boardPointAtCanvasPixel(margins.left + 53, margins.top - 1)).toBeNull();
    expect(boardPointAtCanvasPixel(margins.left - 1, margins.top + 53)).toBeNull();
  });
});

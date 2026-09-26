import { describe, expect, test } from 'bun:test';
import { gridToPixel } from './gameUtils';
import {
  activeLilyPadCellKeys,
  activeLilyPadGridCells,
  boardPointGridCell,
  collectGridCellKeys,
  gridCellKey,
  isActiveLilyPadCell,
  isPointOnLilyPad,
} from './lilyPads';

type PositionedTestEntity = { components: { position: { x: number; y: number } } };
type MathProblemTestEntity = PositionedTestEntity & {
  components: PositionedTestEntity['components'] & {
    mathProblem: { consumed: boolean };
  };
};

const positioned = (x: number, y: number): PositionedTestEntity => {
  const pixel = gridToPixel(x, y);
  return { components: { position: pixel } };
};

const mathProblem = (
  x: number,
  y: number,
  consumed: boolean,
): MathProblemTestEntity => ({
  components: {
    position: gridToPixel(x, y),
    mathProblem: { consumed },
  },
});

describe('lily pad grid helpers', () => {
  test('active lily pad cells include only unconsumed math problems', () => {
    const activeCells = activeLilyPadGridCells([
      mathProblem(0, 0, false),
      mathProblem(1, 2, true),
      mathProblem(5, 4, false),
    ]);

    expect(activeCells).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 4 },
    ]);
  });

  test('cell key sets use grid coordinates for positioned entities', () => {
    expect(collectGridCellKeys([
      positioned(2, 1),
      positioned(3, 4),
    ])).toEqual(new Set(['2,1', '3,4']));
  });

  test('active lily pad lookup uses the shared grid key format', () => {
    const activeCells = activeLilyPadCellKeys([
      mathProblem(1, 1, false),
      mathProblem(2, 1, true),
    ]);

    expect(activeCells.has(gridCellKey({ x: 1, y: 1 }))).toBe(true);
    expect(isActiveLilyPadCell({ x: 2, y: 1 }, activeCells)).toBe(false);
  });

  test('board points select their own cell, including gaps and the far edge', () => {
    expect(boardPointGridCell({ x: 106, y: 53 })).toEqual({ x: 1, y: 0 });
    expect(boardPointGridCell({ x: 180, y: 53 })).toEqual({ x: 1, y: 0 });
    expect(boardPointGridCell({ x: 636, y: 530 })).toEqual({ x: 5, y: 4 });
  });

  test('a gap click near the fly does not count as an Eat tap', () => {
    const currentPad = { x: 0, y: 0 };
    expect(isPointOnLilyPad({ x: 53, y: 53 }, currentPad)).toBe(true);
    expect(isPointOnLilyPad({ x: 106, y: 53 }, currentPad)).toBe(false);
  });
});

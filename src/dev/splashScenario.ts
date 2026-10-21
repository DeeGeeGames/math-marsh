import { boardForDifficulty } from '../ecs/boardGeometry';
import type { GameEngine } from '../ecs/Engine';
import { enemyComponents, mathProblemComponents, playerComponents } from '../ecs/entities';
import { gridToPixel } from '../ecs/gameUtils';
import { gridCells, gridCellKey, type GridCell } from '../ecs/lilyPads';
import type { EnemyType } from '../types/shared';
import type { MathDifficulty } from '../ecs/types';

export type SplashPreviewCount = 1 | 2 | 3 | 4;

/** Legal terrain fixture: each enemy has a supporting pad until it is consumed. */
export const populateSplashScenario = function(
	world: GameEngine,
	count: SplashPreviewCount,
	{ staggered = false, reverseOrder = false, difficulty = 'expert' }: {
		staggered?: boolean;
		reverseOrder?: boolean;
		difficulty?: MathDifficulty;
	} = {},
): { enemyIds: number[]; supportIds: number[] } {
	const board = boardForDifficulty(difficulty);
	world.setResource('board', board);
	world.setResource('mathDifficulty', difficulty);
	world.setResource('currentLevel', 1);
	world.setResource('enemySpawn', { index: 0, roster: [] });
	const placements: readonly GridCell[] = staggered
		? [{ x: 0, y: 1 }, { x: board.width - 1, y: 1 }]
		: [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 2 }].slice(0, count);
	const supports: readonly GridCell[] = staggered
		? [{ x: 0, y: 2 }, { x: board.width - 1, y: 2 }]
		: [{ x: 1, y: 1 }];
	const supportKeys = new Set(supports.map(gridCellKey));
	const missingNeighbors = new Set(placements.flatMap(cell => [
		{ x: cell.x - 1, y: cell.y }, { x: cell.x + 1, y: cell.y },
		{ x: cell.x, y: cell.y - 1 }, { x: cell.x, y: cell.y + 1 },
	]).map(gridCellKey).filter(key => !supportKeys.has(key)));
	const supportIds: number[] = [];
	gridCells(board).forEach(function(cell, index): void {
		const position = gridToPixel(cell.x, cell.y);
		const components = mathProblemComponents(position.x, position.y, index % 9 + 1, 1);
		if (!components.mathProblem) throw new Error('Splash fixture requires a numbered pad');
		components.mathProblem.consumed = missingNeighbors.has(gridCellKey(cell));
		const problem = world.spawn(components, { scope: 'playing' });
		if (supportKeys.has(gridCellKey(cell))) supportIds.push(problem.id);
	});
	const occupied = new Set(placements.map(gridCellKey));
	const playerCell = gridCells(board).toReversed().find(cell =>
		!missingNeighbors.has(gridCellKey(cell)) && !occupied.has(gridCellKey(cell)));
	if (!playerCell) throw new Error('Splash fixture has no free player pad');
	const player = gridToPixel(playerCell.x, playerCell.y);
	world.spawn({ ...playerComponents(player.x, player.y), timers: {} }, { scope: 'playing' });
	const types: readonly EnemyType[] = ['lizard', 'frog', 'spider', 'lizard'];
	const entries = placements.map((cell, index) => ({ cell, type: types[index] ?? 'lizard' }));
	const enemyIds = (reverseOrder ? entries.toReversed() : entries).map(function({ cell, type }): number {
		const position = gridToPixel(cell.x, cell.y);
		return world.spawn({ ...enemyComponents(position.x, position.y, type, 'guard'), timers: {} }, { scope: 'playing' }).id;
	});
	return { enemyIds, supportIds };
};

export const consumeSplashSupport = function(world: GameEngine, id: number): void {
	world.mutateComponent(id, 'mathProblem', problem => { problem.consumed = true; });
};

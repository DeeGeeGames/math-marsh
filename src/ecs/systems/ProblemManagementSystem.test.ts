import * as equations from '../../math/equations';
import * as audio from '../../audio/audio';
import { gridCells } from '../lilyPads';
import type { EnemyType } from '../../types/shared';
import { GAME_CONFIG } from '../../config';
import { describe, expect, spyOn, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import type { GameEngine } from '../Engine';
import { BOARD_SIZES } from '../boardGeometry';
import { enemyComponents, mathProblemComponents, playerComponents } from '../entities';
import { gridToPixel } from '../gameUtils';
import { createEquationModeState, evaluateEquationSelection } from '../../math/equations';
import { addProblemManagementSystemToEngine } from './ProblemManagementSystem';

describe('board population', () => {
	(['easy', 'medium', 'expert'] as const).forEach(difficulty => {
		(['add', 'subtract', 'multiply', 'divide'] as const).forEach(operation => {
			test(`${difficulty} ${operation} fills its board and preserves valid answers for every prompt kind`, async () => {
				await Promise.all([1, 2, 3].map(async level => {
					const board = BOARD_SIZES[difficulty];
					const world = ECSpresso.create<ConfigOf<GameEngine>>().build();
					world.setResource('board', board);
					world.setResource('enemySpawn', { index: 0, roster: [] });
					world.setResource('currentLevel', level);
					world.setResource('gameMode', [operation]);
					world.setResource('mathDifficulty', difficulty);
					world.setResource('equationMode', createEquationModeState(level, difficulty, [operation]));
					addProblemManagementSystemToEngine(world);
					await world.initialize();
					const position = gridToPixel(1, 1);
					world.spawn({ ...playerComponents(position.x, position.y), timers: {} });
					world.update(0.01);
					const problems = world.getEntitiesWithQuery(['mathProblem', 'position']);
					const state = world.getResource('equationMode');
					expect(problems).toHaveLength(board.width * board.height);
					expect(problems.every(problem => problem.components.position.x < board.width * GAME_CONFIG.GRID.CELL_SIZE
						&& problem.components.position.y < board.height * GAME_CONFIG.GRID.CELL_SIZE)).toBe(true);
					const solutions = state.operandsRequired === 1
						? problems.map(problem => [problem.components.mathProblem.value])
						: problems.flatMap(left => problems.filter(right => right.id !== left.id)
							.map(right => [left.components.mathProblem.value, right.components.mathProblem.value]));
					expect(solutions.some(values => evaluateEquationSelection(state, values))).toBe(true);
					await world.dispose();
				}));
			});
		});
	});
});

async function createProgressionWorld(level: number, roster: readonly EnemyType[]): Promise<GameEngine> {
	const world = ECSpresso.create<ConfigOf<GameEngine>>().build();
	world.setResource('board', BOARD_SIZES.easy);
	world.setResource('enemySpawn', { index: 0, roster });
	world.setResource('currentLevel', level);
	world.setResource('gameMode', ['add']);
	world.setResource('mathDifficulty', 'easy');
	world.setResource('equationMode', { ...createEquationModeState(level, 'easy', ['add']), target: level === 1 ? 3 : 6 });
	addProblemManagementSystemToEngine(world);
	await world.initialize();
	const position = gridToPixel(1, 1);
	world.spawn({ ...playerComponents(position.x, position.y), timers: {} });
	gridCells(BOARD_SIZES.easy).forEach(cell => {
		const pixel = gridToPixel(cell.x, cell.y);
		world.spawn(mathProblemComponents(pixel.x, pixel.y, 3, 1));
	});
	return world;
}

function clearPads(world: GameEngine, count: number): void {
	world.getEntitiesWithQuery(['mathProblem']).forEach((problem, index) => {
		world.mutateComponent(problem.id, 'mathProblem', value => { value.consumed = index < count; });
	});
	world.setResource('equationMode', { ...world.getResource('equationMode'), clearedThisLevel: count });
}

describe('level completion with enemies', () => {
	test('Easy completes after six pads while an enemy covers a remaining answer, after feedback finishes', async () => {
		const sound = spyOn(audio, 'playSound').mockImplementation(() => {});
		const world = await createProgressionWorld(1, ['lizard']);
		const transition = spyOn(world, 'pushScreen').mockImplementation(async () => {});
		try {
			const enemyPosition = gridToPixel(2, 2);
			world.spawn(enemyComponents(enemyPosition.x, enemyPosition.y, 'lizard', 'guard'));
			clearPads(world, 5);
			world.update(0.01);
			expect(transition).not.toHaveBeenCalled();
			clearPads(world, 6);
			const completedMode = world.getResource('equationMode');
			world.setResource('equationMode', {
				...completedMode,
				feedback: { kind: 'correct', startedAt: 0 },
			});
			world.update(0.01);
			expect(transition).not.toHaveBeenCalled();
			world.setResource('equationMode', completedMode);
			world.update(0.01);
			await Promise.resolve();
			expect(transition).toHaveBeenCalledWith('levelComplete', expect.objectContaining({ completedLevel: world.getResource('currentLevel'), nextLevel: world.getResource('currentLevel') + 1 }));
		} finally {
			await world.dispose();
			transition.mockRestore();
			sound.mockRestore();
		}
	});

	test('caps a two-number level using pending enemies and ignores enemy movement', async () => {
		const sound = spyOn(audio, 'playSound').mockImplementation(() => {});
		const world = await createProgressionWorld(2, ['lizard', 'lizard', 'lizard', 'lizard', 'lizard']);
		const transition = spyOn(world, 'pushScreen').mockImplementation(async () => {});
		try {
			const enemy = world.spawn(enemyComponents(0, 0, 'lizard', 'guard'));
			clearPads(world, 2);
			world.update(0.01);
			expect(transition).not.toHaveBeenCalled();
			world.mutateComponent(enemy.id, 'position', position => { position.x = 212; position.y = 212; });
			world.update(0.01);
			expect(transition).not.toHaveBeenCalled();
			clearPads(world, 4);
			world.update(0.01);
			await Promise.resolve();
			expect(transition).toHaveBeenCalledWith('levelComplete', expect.objectContaining({ completedLevel: world.getResource('currentLevel'), nextLevel: world.getResource('currentLevel') + 1 }));
		} finally {
			await world.dispose();
			transition.mockRestore();
			sound.mockRestore();
		}
	});
});


describe('population with occupied pads', () => {
	[1, 2].forEach(availableCount => {
		test(`uses exactly ${availableCount} available pads without truncating answers`, async () => {
			const sound = spyOn(audio, 'playSound').mockImplementation(() => {});
			const generator = spyOn(equations, 'equationProblemValuesForCandidate');
			const world = await createProgressionWorld(2, []);
			const transition = spyOn(world, 'pushScreen').mockImplementation(async () => {});
			try {
				const problems = world.getEntitiesWithQuery(['mathProblem']);
				problems.forEach((problem, index) => {
					if (index >= problems.length - availableCount) {
						world.removeEntity(problem.id);
						return;
					}
					world.mutateComponent(problem.id, 'mathProblem', value => { value.consumed = true; });
				});
				world.setResource('equationMode', createEquationModeState(2, 'easy', ['add']));
				world.update(0.01);
				const active = world.getEntitiesWithQuery(['mathProblem'])
					.filter(problem => !problem.components.mathProblem.consumed);
				if (availableCount < 2) {
					expect(generator).not.toHaveBeenCalled();
					expect(active).toHaveLength(0);
					return;
				}
				expect(generator).toHaveBeenCalledWith(expect.anything(), expect.anything(), availableCount);
				expect(active).toHaveLength(availableCount);
				expect(world.getEntitiesWithQuery(['mathProblem'])).toHaveLength(9);
				expect(evaluateEquationSelection(world.getResource('equationMode'), active.map(problem => problem.components.mathProblem.value))).toBe(true);
			} finally {
				await world.dispose();
				transition.mockRestore();
				generator.mockRestore();
				sound.mockRestore();
			}
		});
	});
});

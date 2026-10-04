import * as equations from '../../math/equations';
import * as audio from '../../audio/audio';
import { gridCells } from '../lilyPads';
import type { EnemyType } from '../../types/shared';
import { GAME_CONFIG } from '../../config';
import { describe, expect, spyOn, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import type { GameEngine } from '../Engine';
import type { MathDifficulty } from '../types';
import { BOARD_SIZES } from '../boardGeometry';
import { enemyComponents, mathProblemComponents, playerComponents } from '../entities';
import { gridToPixel } from '../gameUtils';
import { createEquationModeState, evaluateEquationSelection } from '../../math/equations';
import { addProblemManagementSystemToEngine } from './ProblemManagementSystem';
import { selectableEquationProblems } from '../selectableEquationProblems';

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
					[gridToPixel(0, 0), gridToPixel(board.width - 1, board.height - 1)].forEach(position => {
						world.spawn(enemyComponents(position.x, position.y, 'lizard', 'guard'));
					});
					world.update(0.01);
					const problems = world.getEntitiesWithQuery(['mathProblem', 'position']);
					const state = world.getResource('equationMode');
					expect(problems).toHaveLength(board.width * board.height);
					expect(problems.every(problem => problem.components.position.x < board.width * GAME_CONFIG.GRID.CELL_SIZE
						&& problem.components.position.y < board.height * GAME_CONFIG.GRID.CELL_SIZE)).toBe(true);
					const selectable = selectableEquationProblems(
						world.getEntitiesWithQuery(['mathProblem', 'position', 'collider', 'renderable'])
							.map(problem => ({ ...problem, components: { ...problem.components, answerConsumption: problem.components.answerConsumption } })),
						world.getEntitiesWithQuery(['enemy', 'position']),
					);
					const solutions = state.operandsRequired === 1
						? selectable.map(problem => [problem.components.mathProblem.value])
						: selectable.flatMap(left => selectable.filter(right => right.id !== left.id)
							.map(right => [left.components.mathProblem.value, right.components.mathProblem.value]));
					expect(solutions.some(values => evaluateEquationSelection(state, values))).toBe(true);
					await world.dispose();
				}));
			});
		});
	});
});

describe('equations with enemy-occupied answers', () => {
	([
		{ level: 1, difficulty: 'easy', target: 10, occupiedValue: 10, freeValues: [3] },
		{ level: 2, difficulty: 'medium', target: 9, occupiedValue: 6, freeValues: [3, 3] },
		{ level: 3, difficulty: 'expert', target: 9, occupiedValue: 9, freeValues: [3, 6] },
	] as const).forEach(({ level, difficulty, target, occupiedValue, freeValues }) => {
		test(`${difficulty} replaces a blocked prompt using only free pads`, async () => {
			const world = await createProgressionWorld(level, ['lizard'], difficulty);
			try {
				const problems = world.getEntitiesWithQuery(['mathProblem', 'position']);
				const blocked = problems[0];
				if (!blocked) throw new Error('Missing test pad');
				world.mutateComponent(blocked.id, 'mathProblem', problem => { problem.value = occupiedValue; });
				problems.slice(1).forEach((problem, index) => {
					const value = freeValues[index % freeValues.length];
					if (value === undefined) throw new Error('Missing free test value');
					world.mutateComponent(problem.id, 'mathProblem', problem => { problem.value = value; });
				});
				world.spawn(enemyComponents(blocked.components.position.x, blocked.components.position.y, 'lizard', 'guard'));
				world.setResource('equationMode', {
					...world.getResource('equationMode'), target, promptValues: [6, 3], selectedProblemIds: [blocked.id],
				});
				world.update(0.01);
				const state = world.getResource('equationMode');
				expect(state.target).not.toBe(target);
				expect(state.selectedProblemIds).toEqual([]);
				expect(evaluateEquationSelection(state, freeValues)).toBe(true);
				// A stationary enemy must not cause repeated prompt changes.
				world.update(0.01);
				expect(world.getResource('equationMode')).toBe(state);
			} finally {
				await world.dispose();
			}
		});
	});

	test('preserves the prompt and partial selection when another copy of the answer is free', async () => {
		const world = await createProgressionWorld(2, ['lizard'], 'medium');
		try {
			const problems = world.getEntitiesWithQuery(['mathProblem', 'position']);
			const blocked = problems[0];
			const selected = problems[1];
			if (!blocked || !selected) throw new Error('Missing test pads');
			world.spawn(enemyComponents(blocked.components.position.x, blocked.components.position.y, 'lizard', 'guard'));
			const state = { ...world.getResource('equationMode'), selectedProblemIds: [selected.id] };
			world.setResource('equationMode', state);
			world.update(0.01);
			expect(world.getResource('equationMode')).toBe(state);
		} finally {
			await world.dispose();
		}
	});

	test('waits for success feedback, then repairs a next prompt blocked during the hold', async () => {
		const world = await createProgressionWorld(1, ['lizard']);
		try {
			const blocked = world.getEntitiesWithQuery(['mathProblem', 'position'])[0];
			if (!blocked) throw new Error('Missing test pad');
			world.mutateComponent(blocked.id, 'mathProblem', problem => { problem.value = 10; });
			const nextMode = { ...world.getResource('equationMode'), target: 10, promptValues: [7, 3] };
			const feedbackMode = { ...world.getResource('equationMode'), feedback: { kind: 'correct' as const, startedAt: 0, nextMode } };
			world.setResource('equationMode', feedbackMode);
			world.spawn(enemyComponents(blocked.components.position.x, blocked.components.position.y, 'lizard', 'guard'));
			world.update(0.01);
			expect(world.getResource('equationMode')).toBe(feedbackMode);
			world.setResource('equationMode', nextMode);
			world.update(0.01);
			expect(world.getResource('equationMode').target).toBe(3);
		} finally {
			await world.dispose();
		}
	});

	test('completes instead of waiting when two distinct free answer pads no longer exist', async () => {
		const sound = spyOn(audio, 'playSound').mockImplementation(() => {});
		const world = await createProgressionWorld(2, ['lizard'], 'medium');
		const transition = spyOn(world, 'pushScreen').mockImplementation(async () => {});
		try {
			const problems = world.getEntitiesWithQuery(['mathProblem', 'position']);
			const blocked = problems[0];
			if (!blocked) throw new Error('Missing test pad');
			problems.slice(2).forEach(problem => {
				world.mutateComponent(problem.id, 'mathProblem', value => { value.consumed = true; });
			});
			world.spawn(enemyComponents(blocked.components.position.x, blocked.components.position.y, 'lizard', 'guard'));
			world.update(0.01);
			expect(world.getResource('equationMode').target).toBe(0);
			expect(transition).toHaveBeenCalledWith('levelComplete', expect.objectContaining({ completedLevel: 2, nextLevel: 3 }));
		} finally {
			await world.dispose();
			transition.mockRestore();
			sound.mockRestore();
		}
	});
});

async function createProgressionWorld(
	level: number,
	roster: readonly EnemyType[],
	difficulty: MathDifficulty = 'easy',
): Promise<GameEngine> {
	const world = ECSpresso.create<ConfigOf<GameEngine>>().build();
	world.setResource('board', BOARD_SIZES.easy);
	world.setResource('enemySpawn', { index: 0, roster });
	world.setResource('currentLevel', level);
	world.setResource('gameMode', ['add']);
	world.setResource('mathDifficulty', difficulty);
	world.setResource('equationMode', {
		...createEquationModeState(level, difficulty, ['add']),
		target: level === 1 ? 3 : 6,
	});
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
		const world = await createProgressionWorld(2, ['lizard', 'lizard', 'lizard', 'lizard', 'lizard'], 'medium');
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
			const world = await createProgressionWorld(2, [], 'medium');
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
				world.setResource('equationMode', createEquationModeState(2, world.getResource('mathDifficulty'), ['add']));
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

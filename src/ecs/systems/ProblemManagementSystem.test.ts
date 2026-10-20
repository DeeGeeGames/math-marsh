import * as equations from '../../math/equations';
import * as audio from '../../audio/audio';
import { gridCells } from '../lilyPads';
import type { EnemyType } from '../../types/shared';
import { GAME_CONFIG } from '../../config';
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import type { GameEngine } from '../Engine';
import type { MathDifficulty } from '../types';
import { BOARD_SIZES } from '../boardGeometry';
import { enemyComponents, mathProblemComponents, playerComponents } from '../entities';
import { gridToPixel } from '../gameUtils';
import { createEquationModeState, evaluateEquationSelection } from '../../math/equations';
import { addProblemManagementSystemToEngine } from './ProblemManagementSystem';
import type { MathProblemEntityWithRenderable } from '../queries';
import { handleEquationProblemSelection } from '../equationSelection';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { selectableEquationProblems } from '../selectableEquationProblems';
import { createTweenPlugin } from 'ecspresso/plugins/scripting/tween';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { startEnemyGridMovement } from './EnemySpriteSystem';
import { createMathSession, equationModeForMathSession } from '../mathMode';
import { initialSavedMathProgress } from '../mathProgressStore';
import { createMathEquationModeState } from '../mathSteps';

let restoreSound: (() => void) | undefined;
beforeEach(function(): void {
	const sound = spyOn(audio, 'playSound').mockImplementation(() => {});
	restoreSound = function(): void { sound.mockRestore(); };
});
afterEach(function(): void { restoreSound?.(); });

describe('board population', () => {
	(['easy', 'medium', 'expert'] as const).forEach(difficulty => {
		(['add', 'subtract', 'multiply', 'divide'] as const).forEach(operation => {
			test(`${difficulty} ${operation} fills its board and preserves valid answers for every prompt kind`, async () => {
				await Promise.all([1, 2, 3].map(async level => {
					const board = BOARD_SIZES[difficulty];
					const world = ECSpresso.create<ConfigOf<GameEngine>>().build();
					world.setResource('gameplayClock', createTimer(Number.POSITIVE_INFINITY));
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
				expect(state.changeNotice).toBeUndefined();
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
	(['easy', 'medium', 'expert'] as const).forEach(difficulty => {
		test(`${difficulty} keeps a single-result 15 while an enemy moves onto only one of two 15s`, async () => {
			const world = ECSpresso.create<ConfigOf<GameEngine>>()
				.withPlugin(createTweenPlugin({ priority: SYSTEM_PRIORITIES.ANIMATION }))
				.build();
			try {
				world.setResource('gameplayClock', createTimer(Number.POSITIVE_INFINITY));
				world.setResource('board', BOARD_SIZES[difficulty]);
				world.setResource('enemySpawn', { index: 0, roster: ['lizard', 'lizard'] });
				world.setResource('currentLevel', 1);
				world.setResource('gameMode', ['add']);
				world.setResource('mathDifficulty', difficulty);
				const state = {
					...createEquationModeState(1, difficulty, ['add']),
					target: 15,
					promptValues: [7, 8],
				};
				world.setResource('equationMode', state);
				addProblemManagementSystemToEngine(world);
				await world.initialize();
				world.spawn({ ...playerComponents(0, 0), timers: {} });
				[3, 15, 15].forEach((value, index) => {
					const position = gridToPixel(index, 0);
					world.spawn(mathProblemComponents(position.x, position.y, value, 1));
				});
				const enemy = world.spawn({ ...enemyComponents(0, 0, 'lizard', 'guard'), timers: {} });
				const firstAnswerPosition = gridToPixel(1, 0);
				const freeAnswerPosition = gridToPixel(2, 0);
				expect(state.promptKind).toBe('selectResult');
				expect(state.operandsRequired).toBe(1);
				world.update(0);
				expect(world.getResource('equationMode')).toBe(state);

				startEnemyGridMovement(world, enemy.id, 'lizard', { x: 0, y: 0 }, { x: 1, y: 0 },
					firstAnswerPosition.x, firstAnswerPosition.y);
				// Exercise real movement interpolation and equation checks on every frame.
				Array.from({ length: 100 }).forEach(() => {
					world.update(0.01);
					expect(world.getResource('equationMode')).toBe(state);
				});
				expect(world.getComponent(enemy.id, 'position')).toEqual(firstAnswerPosition);
				const freeAnswers = selectableEquationProblems(
					world.getEntitiesWithQuery(['mathProblem', 'position', 'collider', 'renderable'])
						.map(function(problem) {
							return { ...problem, components: { ...problem.components, answerConsumption: problem.components.answerConsumption } };
						}),
					world.getEntitiesWithQuery(['enemy', 'position']),
				).filter(problem => problem.components.mathProblem.value === 15);
				expect(freeAnswers).toHaveLength(1);
				expect(freeAnswers[0]?.components.position).toEqual(freeAnswerPosition);
				expect(state.changeNotice).toBeUndefined();
				expect(audio.playSound).not.toHaveBeenCalled();

				// Control: cycling should occur once both 15s really are occupied.
				world.spawn({
					...enemyComponents(freeAnswerPosition.x, freeAnswerPosition.y, 'lizard', 'guard'), timers: {},
				});
				world.update(0.01);
				expect(world.getResource('equationMode').target).not.toBe(15);
				expect(world.getResource('equationMode').changeNotice?.reason).toBe('answerBlocked');
				expect(audio.playSound).toHaveBeenCalledTimes(1);
				expect(audio.playSound).toHaveBeenCalledWith('equationChange');
			} finally {
				await world.dispose();
			}
		});
	});

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
				expect(state.changeNotice).toEqual({
					startedAt: 0,
					origin: { x: blocked.components.position.x + GAME_CONFIG.GRID.CELL_SIZE / 2, y: blocked.components.position.y + GAME_CONFIG.GRID.CELL_SIZE / 2 },
					reason: 'answerBlocked',
				});
				expect(audio.playSound).toHaveBeenCalledTimes(1);
				expect(audio.playSound).toHaveBeenCalledWith('equationChange');
				expect(evaluateEquationSelection(state, freeValues)).toBe(true);
				// A stationary enemy must not cause repeated prompt changes.
				world.update(0.01);
				expect(world.getResource('equationMode')).toBe(state);
				expect(audio.playSound).toHaveBeenCalledTimes(1);
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
			expect(audio.playSound).not.toHaveBeenCalled();
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
			expect(audio.playSound).not.toHaveBeenCalled();
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
			expect(world.getResource('equationMode').target).toBeNull();
			expect(transition).toHaveBeenCalledWith('levelComplete', expect.objectContaining({ completedLevel: 2, nextLevel: 3 }));
		} finally {
			await world.dispose();
			transition.mockRestore();
			sound.mockRestore();
		}
	});
});

test('explains an unavailable answer without blaming an enemy', async () => {
	const world = await createProgressionWorld(1, []);
	try {
		world.setResource('equationMode', { ...world.getResource('equationMode'), target: 9, promptValues: [6, 3] });
		world.update(0.01);
		expect(world.getResource('equationMode').changeNotice).toEqual({
			startedAt: 0,
			origin: { x: GAME_CONFIG.GRID.CELL_SIZE * 1.5, y: GAME_CONFIG.GRID.CELL_SIZE * 1.5 },
			reason: 'answerUnavailable',
		});
		expect(audio.playSound).toHaveBeenCalledWith('equationChange');
	} finally {
		await world.dispose();
	}
});

async function createProgressionWorld(
	level: number,
	roster: readonly EnemyType[],
	difficulty: MathDifficulty = 'easy',
): Promise<GameEngine> {
	const world = ECSpresso.create<ConfigOf<GameEngine>>().build();
	world.setResource('gameplayClock', createTimer(Number.POSITIVE_INFINITY));
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
	test('eliminating enemies do not keep their old pad out of a repopulated board', async () => {
		const world = await createProgressionWorld(1, []);
		try {
			world.getEntitiesWithQuery(['mathProblem']).forEach(problem => world.removeEntity(problem.id));
			const enemyPosition = gridToPixel(2, 2);
			const enemy = world.spawn({
				...enemyComponents(enemyPosition.x, enemyPosition.y, 'spider', 'guard'),
				timers: {},
				enemyElimination: { deathScale: 0 },
			});

			world.update(0.01);

			const problemOnEliminatedPad = world.getEntitiesWithQuery(['position', 'mathProblem'])
				.find(problem => problem.components.position.x === enemyPosition.x
					&& problem.components.position.y === enemyPosition.y);
			expect(problemOnEliminatedPad).toBeDefined();
			expect(world.hasComponent(enemy.id, 'enemyElimination')).toBe(true);
		} finally {
			await world.dispose();
		}
	});

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

const testMathProblems = function(world: GameEngine): MathProblemEntityWithRenderable[] {
	return world.getEntitiesWithQuery(['position', 'mathProblem', 'collider', 'renderable'])
		.map(problem => ({ ...problem, components: { ...problem.components, answerConsumption: problem.components.answerConsumption } }));
};

describe('premature completion regressions', () => {
	(['add', 'subtract', 'multiply', 'divide'] as const).forEach(operation => {
		test(`Easy ${operation} requires six answers even when remaining numbers cannot form a prompt`, async () => {
			const sound = spyOn(audio, 'playSound').mockImplementation(() => {});
			const world = await createProgressionWorld(1, ['lizard']);
			const transition = spyOn(world, 'pushScreen').mockImplementation(async () => {});
			try {
				world.setResource('gameMode', [operation]);
				world.setResource('equationMode', createEquationModeState(1, 'easy', [operation]));
				world.setResource('equationsSolved', 0);
				world.setResource('gameplayClock', createTimer(Number.POSITIVE_INFINITY));
				// 11 cannot be an Easy level-one result for any of these operations.
				world.getEntitiesWithQuery(['mathProblem']).forEach(problem => {
					world.mutateComponent(problem.id, 'mathProblem', value => { value.value = 11; });
				});
				const occupied = gridToPixel(2, 2);
				world.spawn(enemyComponents(occupied.x, occupied.y, 'lizard', 'guard'));
				const player = world.getSingleton(['position', 'player', 'pathFollower', 'collider', 'timers']);
				for (let solved = 1; solved <= 6; solved += 1) {
					world.update(0.01);
					expect(transition).not.toHaveBeenCalled();
					const state = world.getResource('equationMode');
					const free = selectableEquationProblems(
						testMathProblems(world),
						world.getEntitiesWithQuery(['position', 'enemy']),
					);
					const answer = free.find(problem => evaluateEquationSelection(state, [problem.components.mathProblem.value]));
					if (!answer) throw new Error('No playable answer after restoring the board');
					handleEquationProblemSelection(world, player, answer, free, {
						equationMode: state, gameMode: [operation], mathDifficulty: 'easy',
					});
					world.update(0.01);
					expect(transition).not.toHaveBeenCalled();
					const next = world.getResource('equationMode').feedback?.nextMode;
					if (!next) throw new Error('Expected correct-answer feedback');
					world.setResource('equationMode', next);
					world.update(0.01);
					expect(world.getResource('equationMode').clearedThisLevel).toBe(solved);
					expect(world.getResource('equationsSolved')).toBe(solved);
					expect(world.getEntitiesWithQuery(['mathProblem']).filter(problem => problem.components.mathProblem.consumed)).toHaveLength(solved);
					if (solved < 6) expect(transition).not.toHaveBeenCalled();
				}
				expect(transition).toHaveBeenCalledTimes(1);
				expect(transition).toHaveBeenCalledWith('levelComplete', expect.objectContaining({ completedLevel: 1, nextLevel: 2 }));
			} finally {
				await world.dispose();
				transition.mockRestore();
				sound.mockRestore();
			}
		});
	});

	test('a zero-result subtraction prompt remains playable and can be consumed', async () => {
		const sound = spyOn(audio, 'playSound').mockImplementation(() => {});
		const world = await createProgressionWorld(1, ['lizard']);
		const transition = spyOn(world, 'pushScreen').mockImplementation(async () => {});
		try {
			clearPads(world, 2);
			const answer = testMathProblems(world)
				.find(problem => !problem.components.mathProblem.consumed);
			if (!answer) throw new Error('Missing zero answer pad');
			world.mutateComponent(answer.id, 'mathProblem', problem => { problem.value = 0; });
			const state = { ...createEquationModeState(1, 'easy', ['subtract'], 2), target: 0, promptValues: [3, 3] };
			world.setResource('gameMode', ['subtract']);
			world.setResource('equationMode', state);
			world.setResource('equationsSolved', 2);
			world.setResource('gameplayClock', createTimer(Number.POSITIVE_INFINITY));
			world.update(0.01);
			expect(world.getResource('equationMode')).toBe(state);
			expect(transition).not.toHaveBeenCalled();
			handleEquationProblemSelection(
				world,
				world.getSingleton(['position', 'player', 'pathFollower', 'collider', 'timers']),
				answer,
				testMathProblems(world),
				{ equationMode: state, gameMode: ['subtract'], mathDifficulty: 'easy' },
			);
			expect(answer.components.mathProblem.consumed).toBe(true);
			expect(world.getResource('equationsSolved')).toBe(3);
			expect(world.getResource('equationMode').feedback?.kind).toBe('correct');
		} finally {
			await world.dispose();
			transition.mockRestore();
			sound.mockRestore();
		}
	});

	test('restores a two-pad answer without changing consumed or enemy-occupied pads', async () => {
		const world = await createProgressionWorld(2, ['lizard'], 'medium');
		const transition = spyOn(world, 'pushScreen').mockImplementation(async () => {});
		try {
			clearPads(world, 2);
			world.setResource('gameMode', ['divide']);
			world.setResource('equationMode', createEquationModeState(2, 'medium', ['divide'], 2));
			const problems = world.getEntitiesWithQuery(['position', 'mathProblem']);
			const primes = [17, 19, 23, 29, 31, 37, 41, 43, 47];
			problems.forEach((problem, index) => {
				const value = primes[index];
				if (value === undefined) throw new Error('Missing test value');
				world.mutateComponent(problem.id, 'mathProblem', data => { data.value = value; });
			});
			const blocked = problems[2];
			if (!blocked) throw new Error('Missing occupied pad');
			world.spawn(enemyComponents(blocked.components.position.x, blocked.components.position.y, 'lizard', 'guard'));
			world.update(0.01);
			expect(transition).not.toHaveBeenCalled();
			expect(blocked.components.mathProblem.value).toBe(23);
			expect(problems.slice(0, 2).map(problem => problem.components.mathProblem.value)).toEqual([17, 19]);
			const free = selectableEquationProblems(
				testMathProblems(world),
				world.getEntitiesWithQuery(['position', 'enemy']),
			);
			const state = world.getResource('equationMode');
			expect(free.some(left => free.some(right => left.id !== right.id
				&& evaluateEquationSelection(state, [left.components.mathProblem.value, right.components.mathProblem.value])))).toBe(true);
			expect(state.clearedThisLevel).toBe(2);
		} finally {
			await world.dispose();
			transition.mockRestore();
		}
	});
});

describe('math answer assessment tracking', () => {
	test('credits only the answered operation in a mixed-operation game', async () => {
		const world = await createProgressionWorld(1, []);
		world.setResource('equationsSolved', 0);
		world.setResource('equationsSolvedThisBoard', 0);
		try {
			const player = world.getSingleton(['position', 'player', 'pathFollower', 'collider', 'timers']);
			const session = createMathSession(initialSavedMathProgress());
			world.setResource('mathSession', {
				tracks: { ...session.tracks, add: { ...session.tracks.add, assessment: {
					correctAnswers: 3, incorrectAnswers: 1, activeSeconds: 25, expectedSecondsTotal: 30,
				} } },
			});
			const baseMode = createMathEquationModeState(1, 'multiply', 0);
			if (!baseMode) throw new Error('Missing multiplication mode');
			const mode = { ...baseMode, target: 3, promptValues: [1, 3] };
			world.setResource('equationMode', mode);
			const problems = testMathProblems(world);
			const answer = problems.find(problem => problem.components.mathProblem.value === 3);
			if (!answer) throw new Error('Missing multiplication answer');
			handleEquationProblemSelection(world, player, answer, problems, {
				equationMode: mode, gameMode: ['add', 'multiply'], mathDifficulty: 'expert',
				mathSession: world.getResource('mathSession'),
			});
			expect(world.getResource('mathSession')?.tracks.multiply.assessment.correctAnswers).toBe(1);
			expect(world.getResource('mathSession')?.tracks.multiply.assessment.expectedSecondsTotal).toBeGreaterThan(0);
			expect(world.getResource('mathSession')?.tracks.add.assessment).toEqual({
				correctAnswers: 3, incorrectAnswers: 1, activeSeconds: 25, expectedSecondsTotal: 30,
			});
		} finally { await world.dispose(); }
	});
	test('repairs prior result pads before an in-range math operand prompt', async () => {
		const world = await createProgressionWorld(1, []);
		try {
			world.setResource('currentLevel', 4);
			world.setResource('mathDifficulty', 'medium');
			const session = createMathSession({ ...initialSavedMathProgress(), add: { currentStep: 4, highestUnlockedStep: 4 } });
			world.setResource('mathSession', {
				tracks: { ...session.tracks, add: { ...session.tracks.add, assessment: {
					correctAnswers: 3, incorrectAnswers: 0, activeSeconds: 12, expectedSecondsTotal: 30,
				} } },
			});
			world.getEntitiesWithQuery(['mathProblem']).forEach((problem, index) => {
				world.mutateComponent(problem.id, 'mathProblem', value => { value.value = index % 2 === 0 ? 8 : 10; });
			});

			world.update(0.01);

			const mode = world.getResource('equationMode');
			expect(mode.promptKind).toBe('selectOperands');
			expect(mode.promptValues.every(value => value >= 1 && value <= 6)).toBe(true);
			expect(mode.target).toBeGreaterThan(0);
		} finally {
			await world.dispose();
		}
	});

	test('counts a two-pad correct equation once and one completed wrong retry once', async () => {
		const world = await createProgressionWorld(7, []);
		try {
			const player = world.getSingleton(['position', 'player', 'pathFollower', 'collider', 'timers']);
			const session = createMathSession({ ...initialSavedMathProgress(), add: { currentStep: 7, highestUnlockedStep: 7 } });
			world.setResource('mathSession', session);
			world.setResource('gameMode', ['add']);
			world.setResource('mathDifficulty', 'easy');
			world.setResource('gameplayClock', createTimer(Number.POSITIVE_INFINITY));
			world.setResource('equationsSolved', 0);
			const problems = testMathProblems(world);
			const values = [3, 4, 5];
			problems.slice(0, values.length).forEach((problem, index) => {
				const value = values[index];
				if (value === undefined) throw new Error('Missing math answer value');
				world.mutateComponent(problem.id, 'mathProblem', data => { data.value = value; });
			});

			const resultMode = createMathEquationModeState(7, 'add', 0);
			if (!resultMode) throw new Error('Missing math result prompt');
			const firstAnswer = problems.find(problem => problem.components.mathProblem.value === 3);
			if (!firstAnswer) throw new Error('Missing first math answer');
			const resultState = { ...resultMode, target: 3, promptValues: [1, 2] };
			world.setResource('equationMode', resultState);
			handleEquationProblemSelection(world, player, firstAnswer, problems, {
				equationMode: resultState,
				gameMode: ['add'],
				mathDifficulty: 'easy',
				mathSession: session,
			});
			expect(world.getResource('mathSession')?.tracks.add.assessment.correctAnswers).toBe(1);

			const updatedSession = world.getResource('mathSession');
			if (!updatedSession) throw new Error('Missing updated math assessment');
			const operandsMode = createMathEquationModeState(7, 'add', 1);
			if (!operandsMode) throw new Error('Missing math operands prompt');
			const operandProblems = problems.filter(problem => problem.components.mathProblem.value === 4 || problem.components.mathProblem.value === 5);
			const stateForOperands = { ...operandsMode, target: 9, promptValues: [4, 5] };
			world.setResource('equationMode', stateForOperands);
			const [left, right] = operandProblems;
			if (!left || !right) throw new Error('Missing two-pad math answer');
			handleEquationProblemSelection(world, player, left, problems, {
				equationMode: stateForOperands,
				gameMode: ['add'],
				mathDifficulty: 'easy',
				mathSession: updatedSession,
			});
			const partialSelection = world.getResource('equationMode');
			expect(world.getResource('mathSession')?.tracks.add.assessment.correctAnswers).toBe(1);
			handleEquationProblemSelection(world, player, right, problems, {
				equationMode: partialSelection,
				gameMode: ['add'],
				mathDifficulty: 'easy',
				mathSession: world.getResource('mathSession'),
			});
			expect(world.getResource('mathSession')?.tracks.add.assessment.correctAnswers).toBe(2);

			const wrongModeBase = createMathEquationModeState(7, 'add', 2);
			if (!wrongModeBase) throw new Error('Missing math mixed prompt');
			const wrongMode = {
				...wrongModeBase,
				promptKind: 'selectOperandAndResult' as const,
				operandsRequired: 2,
				target: 7,
				promptValues: [2, 5],
			};
			const wrongProblems = problems.filter(problem => !problem.components.mathProblem.consumed);
			const [wrongLeft, wrongRight] = wrongProblems;
			if (!wrongLeft || !wrongRight) throw new Error('Missing incorrect math pair');
			world.setResource('equationMode', wrongMode);
			handleEquationProblemSelection(world, player, wrongLeft, wrongProblems, {
				equationMode: wrongMode,
				gameMode: ['add'],
				mathDifficulty: 'easy',
				mathSession: world.getResource('mathSession'),
			});
			expect(world.getResource('mathSession')?.tracks.add.assessment.incorrectAnswers).toBe(0);
			handleEquationProblemSelection(world, player, wrongRight, wrongProblems, {
				equationMode: world.getResource('equationMode'),
				gameMode: ['add'],
				mathDifficulty: 'easy',
				mathSession: world.getResource('mathSession'),
			});
			expect(world.getResource('mathSession')?.tracks.add.assessment).toMatchObject({
				correctAnswers: 2,
				incorrectAnswers: 1,
			});
		} finally {
			await world.dispose();
		}
	});
});

for (const correct of [true, false]) {
	test(`after assessment completion a ${correct ? 'correct' : 'wrong'} answer preserves the next sample and Easy format`, async () => {
		const world = await createProgressionWorld(1, []);
		try {
			const player = world.getSingleton(['position', 'player', 'pathFollower', 'collider', 'timers']);
			const initial = createMathSession(initialSavedMathProgress());
			const session = { tracks: { ...initial.tracks, add: { ...initial.tracks.add, step: 7 } } };
			world.setResource('mathSession', session);
			world.setResource('mathRoundCompletedThisBoard', true);
			world.setResource('equationsSolved', 0);
			const mode = { ...equationModeForMathSession(session, ['add'], 1), target: 3, promptValues: [1, 2] };
			world.setResource('equationMode', mode);
			const problems = testMathProblems(world);
			const answer = problems[0];
			if (!answer) throw new Error('Missing answer pad');
			world.mutateComponent(answer.id, 'mathProblem', data => { data.value = correct ? 3 : 4; });
			handleEquationProblemSelection(world, player, answer, problems, {
				equationMode: mode, gameMode: ['add'], mathDifficulty: 'easy', mathSession: session,
			});
			expect(world.getResource('mathSession')).toBe(session);
			const nextMode = world.getResource('equationMode').feedback?.nextMode;
			if (correct) {
				expect(nextMode?.promptKind).toBe('selectResult');
				expect(nextMode?.operandRanges).toEqual(mode.operandRanges);
			}
		} finally { await world.dispose(); }
	});
}

for (const difficulty of ['easy', 'medium', 'expert'] as const) {
	test(`${difficulty} spawns playable boards with advanced number ranges and its original level formats`, async () => {
		for (const level of [1, 2, 3]) {
			const world = ECSpresso.create<ConfigOf<GameEngine>>().build();
			try {
				const session = createMathSession({ ...initialSavedMathProgress(), add: { currentStep: 11, highestUnlockedStep: 11 } });
				const mode = equationModeForMathSession(session, ['add'], level, 0, difficulty);
				const board = BOARD_SIZES[difficulty];
				world.setResource('gameplayClock', createTimer(Number.POSITIVE_INFINITY));
				world.setResource('board', board);
				world.setResource('enemySpawn', { index: 0, roster: [] });
				world.setResource('currentLevel', level);
				world.setResource('gameMode', ['add']);
				world.setResource('mathDifficulty', difficulty);
				world.setResource('mathSession', session);
				world.setResource('equationMode', mode);
				addProblemManagementSystemToEngine(world);
				await world.initialize();
				const position = gridToPixel(1, 1);
				world.spawn({ ...playerComponents(position.x, position.y), timers: {} });
				world.update(0.01);
				const problems = testMathProblems(world);
				const state = world.getResource('equationMode');
				expect(problems).toHaveLength(board.width * board.height);
				expect(state.promptKind).toBe(equations.equationPromptKindForLevel(level, difficulty));
				expect(state.operandRanges.left.max).toBe(20);
				const solutions = state.operandsRequired === 1
					? problems.map(problem => [problem.components.mathProblem.value])
					: problems.flatMap(left => problems.filter(right => right.id !== left.id)
						.map(right => [left.components.mathProblem.value, right.components.mathProblem.value]));
				expect(solutions.some(values => evaluateEquationSelection(state, values))).toBe(true);
			} finally { await world.dispose(); }
		}
	});
}

import { describe, expect, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import { createCoroutinePlugin } from 'ecspresso/plugins/scripting/coroutine';
import { createTimer, createTimerPlugin } from 'ecspresso/plugins/scripting/timers';
import { createTweenPlugin } from 'ecspresso/plugins/scripting/tween';
import { ANIMATION_CONFIG, GAME_CONFIG } from '../config';
import type { EnemyType } from '../types/shared';
import { BOARD_SIZES } from './boardGeometry';
import type { GameEngine } from './Engine';
import { enemyComponents, mathProblemComponents, playerComponents } from './entities';
import { gridToPixel, pixelToGrid } from './gameUtils';
import { gridCells } from './lilyPads';
import {
	enemyQuery,
	enemyWithColliderQuery,
	frogTongueQuery,
} from './queries';
import type { MathDifficulty, TimerSlot } from './types';
import { configureGameScreens } from './screenConfiguration';
import { addAISystemToEngine } from './systems/AISystem';
import { addEnemySpawnSystemToEngine } from './systems/EnemySpawnSystem';
import { startDeathAnimation } from './systems/AnimationSystem';
import { startEnemyGridMovement, startEnemyGridTurn } from './systems/EnemySpriteSystem';
import { registerFrogTongueInit } from './systems/FrogTongueSystem';
import { registerGameplayClockLifecycle } from './gameplayClockLifecycle';
import { lizardEliminated, frogEliminated, spiderEliminated } from './assets';

type TestConfig = Omit<ConfigOf<GameEngine>, 'screens' | 'resources'> & {
	screens: {};
	resources: Omit<ConfigOf<GameEngine>['resources'], '$screen'>;
};

const ENEMY_IMAGE: Record<EnemyType, string> = {
	lizard: lizardEliminated,
	frog: frogEliminated,
	spider: spiderEliminated,
};

const ADJACENT_CELLS = [
	{ x: 1, y: 0 },
	{ x: 1, y: 2 },
	{ x: 0, y: 1 },
	{ x: 2, y: 1 },
] as const;

interface Scenario {
	world: GameEngine;
	enemyId: number;
	neighborProblemIds: number[];
}

const createScenario = async function(
	enemyType: EnemyType = 'lizard',
	difficulty: MathDifficulty = 'easy',
	includeAI = true,
): Promise<Scenario> {
	const world = ECSpresso.create<TestConfig>()
		.withPlugin(createTimerPlugin<TimerSlot>({ priority: 95 }))
		.withPlugin(createTweenPlugin({ priority: 75 }))
		.withPlugin(createCoroutinePlugin({ priority: 90, phase: 'preUpdate' }))
		.withScreens(configureGameScreens)
		.build();
	world.setResource('board', BOARD_SIZES.easy);
	world.setResource('currentLevel', 1);
	world.setResource('mathDifficulty', difficulty);
	world.setResource('enemySpawn', { index: 0, roster: [] });
	const gameplaySystems = world.systemScope({ inScreens: ['playing'] });
	if (includeAI) addAISystemToEngine(gameplaySystems);
	addEnemySpawnSystemToEngine(gameplaySystems);
	registerFrogTongueInit(world);
	registerGameplayClockLifecycle(world);
	await world.initialize();
	await world.setScreen('playing', { level: 1, isFreshGame: false });

	const playerPosition = gridToPixel(0, 0);
	world.spawn({ ...playerComponents(playerPosition.x, playerPosition.y), timers: {} });
	gridCells(BOARD_SIZES.easy).forEach(cell => {
		const position = gridToPixel(cell.x, cell.y);
		world.spawn(mathProblemComponents(position.x, position.y, 1, 1));
	});
	const enemyPosition = gridToPixel(1, 1);
	const enemy = world.spawn({
		...enemyComponents(enemyPosition.x, enemyPosition.y, enemyType, 'guard'),
		timers: {},
	}, { scope: 'playing' });

	world.update(0);

	const neighborProblemIds = world.getEntitiesWithQuery(['position', 'mathProblem'])
		.filter(problem => ADJACENT_CELLS.some(cell => {
			const position = gridToPixel(cell.x, cell.y);
			return problem.components.position.x === position.x && problem.components.position.y === position.y;
		}))
		.map(problem => problem.id);
	return { world, enemyId: enemy.id, neighborProblemIds };
};

const consumeNeighborPads = function(world: GameEngine, problemIds: readonly number[]): void {
	problemIds.forEach(problemId => {
		world.mutateComponent(problemId, 'mathProblem', problem => { problem.consumed = true; });
	});
};

describe('trapped enemy elimination', () => {
	(['lizard', 'frog', 'spider'] as const).forEach(enemyType => {
		test(`${enemyType} is removed from active queries and gets its surprised spin-shrink`, async () => {
			const { world, enemyId, neighborProblemIds } = await createScenario(enemyType);
			const activeQuerySamples: { active: number[]; collidable: number[]; tongue: number[] }[] = [];
			world.addSystem('enemy-elimination-query-probe')
				.addQuery('activeEnemies', enemyQuery)
				.addQuery('collidableEnemies', enemyWithColliderQuery)
				.addQuery('attackableFrogs', frogTongueQuery)
				.runWhenEmpty()
				.setProcess(({ queries }) => {
					activeQuerySamples.push({
						active: queries.activeEnemies.map(enemy => enemy.id),
						collidable: queries.collidableEnemies.map(enemy => enemy.id),
						tongue: queries.attackableFrogs.map(enemy => enemy.id),
					});
				});

			try {
				consumeNeighborPads(world, neighborProblemIds);
				world.update(0);

				const elimination = world.getComponent(enemyId, 'enemyElimination');
				const renderable = world.getComponent(enemyId, 'renderable');
				const tween = world.getComponent(enemyId, 'tween');
				expect(elimination?.deathScale).toBe(ANIMATION_CONFIG.DEATH.SCALE_START);
				expect(renderable?.imageSrc).toBe(ENEMY_IMAGE[enemyType]);
				expect(renderable?.spriteSheet).toBeUndefined();
				expect(tween?.steps[0]?.targets).toEqual(expect.arrayContaining([
					expect.objectContaining({ component: 'enemyElimination', path: ['deathScale'], to: 0 }),
					expect.objectContaining({ component: 'position', path: ['rotation'], to: 1080 }),
				]));
				expect(activeQuerySamples.at(-1)).toEqual({ active: [], collidable: [], tongue: [] });
				expect(world.getComponent(enemyId, 'timers')?.enemyRespawn?.duration)
					.toBe(GAME_CONFIG.ENEMY_ELIMINATION.RESPAWN_SECONDS.easy);
				expect(world.getComponent(enemyId, 'timers')?.enemyMove).toBeUndefined();
				expect(world.getComponent(enemyId, 'timers')?.enemySpawnTelegraph).toBeUndefined();
				if (enemyType === 'frog') {
					expect(world.getComponent(enemyId, 'frogTongue')).toBeUndefined();
					expect(world.getComponent(enemyId, 'coroutine')).toBeUndefined();
				}
			} finally {
				await world.dispose();
			}
		});
	});

	test('checks legal escape space independently of a guard AI idle decision', async () => {
		const { world, enemyId, neighborProblemIds } = await createScenario('lizard');
		try {
			consumeNeighborPads(world, neighborProblemIds.slice(0, -1));
			world.update(0);
			expect(world.hasComponent(enemyId, 'enemyElimination')).toBe(false);
			expect(world.getComponent(enemyId, 'enemy')?.plannedMove).toBeUndefined();
		} finally {
			await world.dispose();
		}
	});

	test('does not eliminate on the frame an announced move is cancelled by a consumed pad', async () => {
		const { world, enemyId, neighborProblemIds } = await createScenario('lizard');
		try {
			consumeNeighborPads(world, neighborProblemIds);
			const enemy = world.getComponent(enemyId, 'enemy');
			const timers = world.getComponent(enemyId, 'timers');
			const target = world.getComponent(neighborProblemIds[0] ?? -1, 'position');
			if (!enemy || !timers || !target) throw new Error('Cancellation fixture is incomplete');
			enemy.plannedMove = pixelToGrid(target.x, target.y);
			timers.enemyMove = createTimer(0.2);
			world.update(0.2);
			expect(enemy.plannedMove).toBeUndefined();
			expect(world.hasComponent(enemyId, 'enemyElimination')).toBe(false);
			world.update(0);
			expect(world.hasComponent(enemyId, 'enemyElimination')).toBe(true);
		} finally {
			await world.dispose();
		}
	});

	test('waits for an enemy turn or movement animation to finish before checking for a trap', async () => {
		for (const movement of ['turn', 'step'] as const) {
			const { world, enemyId, neighborProblemIds } = await createScenario('lizard');
			try {
				if (movement === 'turn') {
					startEnemyGridTurn(world, enemyId, 'lizard', { x: 1, y: 1 }, { x: 2, y: 1 });
					world.update(0);
				} else {
					const to = gridToPixel(2, 1);
					startEnemyGridMovement(world, enemyId, 'lizard', { x: 1, y: 1 }, { x: 2, y: 1 }, to.x, to.y);
					world.update(0);
				}
				consumeNeighborPads(world, neighborProblemIds);
				world.update(0);
				expect(world.hasComponent(enemyId, 'enemyElimination')).toBe(false);
				expect(world.hasComponent(enemyId, 'spriteAnimation')).toBe(true);
			} finally {
				await world.dispose();
			}
		}
	});

	test('does not eliminate a frog while its tongue attack is active', async () => {
		const { world, enemyId, neighborProblemIds } = await createScenario('frog');
		try {
			consumeNeighborPads(world, neighborProblemIds);
			world.disableSystemGroup('coroutines');
			const tongue = world.getComponent(enemyId, 'frogTongue');
			if (!tongue) throw new Error('Frog fixture has no tongue component');
			tongue.phase = 'holding';
			world.update(0);
			expect(world.hasComponent(enemyId, 'enemyElimination')).toBe(false);
			expect(world.getComponent(enemyId, 'frogTongue')?.phase).toBe('holding');
		} finally {
			await world.dispose();
		}
	});

	test('releases an eliminated enemy cell reservation for later enemies in the same AI pass', async () => {
		const { world, enemyId } = await createScenario('lizard');
		try {
			const otherPosition = gridToPixel(1, 0);
			const other = world.spawn({
				...enemyComponents(otherPosition.x, otherPosition.y, 'spider', 'guard'),
				timers: {},
			}, { scope: 'playing' });
			const centerPosition = gridToPixel(1, 1);
			world.getEntitiesWithQuery(['position', 'mathProblem']).forEach(problem => {
				problem.components.mathProblem.consumed = true;
			});
			const centerPad = world.getEntitiesWithQuery(['position', 'mathProblem'])
				.find(problem => problem.components.position.x === centerPosition.x
					&& problem.components.position.y === centerPosition.y);
			if (!centerPad) throw new Error('Reservation fixture has no center pad');
			centerPad.components.mathProblem.consumed = false;
			world.update(0);
			expect(world.hasComponent(enemyId, 'enemyElimination')).toBe(true);
			expect(world.hasComponent(other.id, 'enemyElimination')).toBe(false);
			expect(world.getComponent(other.id, 'enemy')?.plannedMove).toBeUndefined();
		} finally {
			await world.dispose();
		}
	});

	test('uses three separately configurable difficulty delays', async () => {
		const delays = [
			['easy', 15],
			['medium', 15],
			['expert', 10],
		] as const satisfies readonly (readonly [MathDifficulty, 10 | 15])[];
		for (const [difficulty, expectedDelay] of delays) {
			const { world, enemyId, neighborProblemIds } = await createScenario('spider', difficulty);
			try {
				consumeNeighborPads(world, neighborProblemIds);
				world.update(0);
				expect(world.getComponent(enemyId, 'timers')?.enemyRespawn?.duration).toBe(expectedDelay);
				expect(GAME_CONFIG.ENEMY_ELIMINATION.RESPAWN_SECONDS[difficulty]).toBe(expectedDelay);
				neighborProblemIds.forEach(problemId => {
					const problem = world.getComponent(problemId, 'mathProblem');
					if (problem) problem.consumed = false;
				});
				world.update(expectedDelay - 0.1);
				expect(world.hasComponent(enemyId, 'enemyElimination')).toBe(true);
				world.update(0.11);
				expect(world.getEntity(enemyId)).toBeUndefined();
				const activeEnemies = world.getEntitiesWithQuery(['enemy', 'position'])
					.filter(entity => !world.hasComponent(entity.id, 'enemyElimination'));
				expect(activeEnemies).toHaveLength(1);
				expect(activeEnemies[0]?.components.enemy.enemyType).toBe('spider');
				expect(world.getResource('enemySpawn').index).toBe(0);
				world.update(5);
				expect(world.getEntitiesWithQuery(['enemy', 'position'])
					.filter(entity => !world.hasComponent(entity.id, 'enemyElimination'))).toHaveLength(1);
			} finally {
				await world.dispose();
			}
		}
	});

	test('pauses the return timer and retries when no active pad is available', async () => {
		const { world, enemyId } = await createScenario('frog', 'easy', false);
		try {
			world.addComponent(enemyId, 'enemyElimination', { deathScale: 0 });
			const timers = world.getComponent(enemyId, 'timers');
			if (!timers) throw new Error('Respawn fixture has no timers');
			timers.enemyRespawn = createTimer(1);
			world.getEntitiesWithQuery(['mathProblem']).forEach(problem => {
				problem.components.mathProblem.consumed = true;
			});
			await world.pushScreen('paused', {});
			world.update(10);
			expect(world.getComponent(enemyId, 'timers')?.enemyRespawn?.elapsed).toBe(0);
			await world.popScreen();
			world.update(1);
			expect(world.getComponent(enemyId, 'enemyElimination')).toBeDefined();
			expect(world.getComponent(enemyId, 'timers')?.enemyRespawn?.duration)
				.toBe(GAME_CONFIG.TIMING.SHORT_DELAY / 1000);
			expect(world.getEntitiesWithQuery(['enemy']).filter(entity => entity.id !== enemyId)).toHaveLength(0);

			world.getEntitiesWithQuery(['mathProblem']).forEach(problem => {
				problem.components.mathProblem.consumed = false;
			});
			world.update(1);
			const activeEnemies = world.getEntitiesWithQuery(['enemy', 'position'])
				.filter(entity => !world.hasComponent(entity.id, 'enemyElimination'));
			expect(activeEnemies).toHaveLength(1);
			expect(activeEnemies[0]?.components.enemy.enemyType).toBe('frog');
			expect(world.getResource('enemySpawn').index).toBe(0);
			world.update(5);
			expect(world.getEntitiesWithQuery(['enemy', 'position'])
				.filter(entity => !world.hasComponent(entity.id, 'enemyElimination'))).toHaveLength(1);
		} finally {
			await world.dispose();
		}
	});

	test('respawn pads avoid the player, active enemies, and spider webs', async () => {
		const { world, enemyId } = await createScenario('frog', 'easy', false);
		try {
			world.addComponent(enemyId, 'enemyElimination', { deathScale: 0 });
			const timers = world.getComponent(enemyId, 'timers');
			if (!timers) throw new Error('Respawn fixture has no timers');
			timers.enemyRespawn = createTimer(0.5);
			world.getEntitiesWithQuery(['mathProblem']).forEach(problem => {
				problem.components.mathProblem.consumed = true;
			});

			const playerOccupiedPad = gridToPixel(0, 0);
			const enemyOccupiedPad = gridToPixel(2, 2);
			const webOccupiedPad = gridToPixel(0, 2);
			world.getEntitiesWithQuery(['position', 'mathProblem']).forEach(problem => {
				const position = problem.components.position;
				const isOccupied = [playerOccupiedPad, enemyOccupiedPad, webOccupiedPad]
					.some(cell => cell.x === position.x && cell.y === position.y);
				if (isOccupied) problem.components.mathProblem.consumed = false;
			});
			const activeEnemy = world.spawn({
				...enemyComponents(enemyOccupiedPad.x, enemyOccupiedPad.y, 'lizard', 'guard'),
				timers: {},
			}, { scope: 'playing' });
			const web = world.spawn({
				position: webOccupiedPad,
				spiderWeb: { freezeTime: 1 },
				timers: {},
			}, { scope: 'playing' });

			world.update(0.5);
			expect(world.hasComponent(enemyId, 'enemyElimination')).toBe(true);
			expect(world.getComponent(enemyId, 'timers')?.enemyRespawn?.duration)
				.toBe(GAME_CONFIG.TIMING.SHORT_DELAY / 1000);
			expect(world.getEntitiesWithQuery(['enemy', 'position'])
				.filter(entity => !world.hasComponent(entity.id, 'enemyElimination'))).toHaveLength(1);

			world.removeEntity(activeEnemy.id);
			world.removeEntity(web.id);
			world.update(1);
			const returned = world.getEntitiesWithQuery(['enemy', 'position'])
				.filter(entity => !world.hasComponent(entity.id, 'enemyElimination'));
			expect(returned).toHaveLength(1);
			expect(returned[0]?.components.enemy.enemyType).toBe('frog');
		} finally {
			await world.dispose();
		}
	});

	test('screen exit removes pending eliminations so level or run changes cannot resurrect them', async () => {
		const { world, enemyId } = await createScenario('lizard', 'easy', false);
		try {
			world.addComponent(enemyId, 'enemyElimination', { deathScale: 0 });
			const timers = world.getComponent(enemyId, 'timers');
			if (!timers) throw new Error('Lifecycle fixture has no timers');
			timers.enemyRespawn = createTimer(0.1);
			world.update(0.11);
			const returned = world.getEntitiesWithQuery(['enemy', 'position'])
				.filter(entity => !world.hasComponent(entity.id, 'enemyElimination'));
			expect(returned).toHaveLength(1);
			const returnedId = returned[0]?.id;
			if (returnedId === undefined) throw new Error('Lifecycle fixture did not respawn');
			await world.setScreen('levelComplete', {
				completedLevel: 1,
				nextLevel: 2,
				startedAt: 0,
			});
			expect(world.getEntity(enemyId)).toBeUndefined();
			expect(world.getEntity(returnedId)).toBeUndefined();
			world.update(20);
			await world.setScreen('playing', { level: 2, isFreshGame: false });
			world.update(0);
			expect(world.getEntitiesWithQuery(['enemy'])).toHaveLength(0);
			expect(world.getResource('enemySpawn').index).toBe(0);

			const nextRunEnemy = world.spawn({
				...enemyComponents(0, 0, 'spider', 'guard'),
				timers: { enemyRespawn: createTimer(1) },
				enemyElimination: { deathScale: 0 },
			}, { scope: 'playing' });
			await world.setScreen('menu', {});
			expect(world.getEntity(nextRunEnemy.id)).toBeUndefined();
			world.update(20);
			await world.setScreen('playing', { level: 1, isFreshGame: true });
			world.update(0);
			expect(world.getEntitiesWithQuery(['enemy'])).toHaveLength(0);
		} finally {
			await world.dispose();
		}
	});

	test('keeps the player death animation target and scale behavior unchanged', async () => {
		const { world } = await createScenario('lizard');
		try {
			const player = world.getEntitiesWithQuery(['player', 'position'])[0];
			if (!player) throw new Error('Player fixture is missing');
			startDeathAnimation(world, player.id, 15);
			world.update(0);
			const tween = world.getComponent(player.id, 'tween');
			expect(tween?.steps[0]?.targets).toEqual(expect.arrayContaining([
				expect.objectContaining({ component: 'player', path: ['deathScale'], to: 0 }),
				expect.objectContaining({ component: 'position', path: ['rotation'], to: 1095 }),
			]));
			expect(world.getComponent(player.id, 'player')?.deathScale).toBe(1);
		} finally {
			await world.dispose();
		}
	});
});

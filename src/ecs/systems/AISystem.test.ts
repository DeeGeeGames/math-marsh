import { describe, expect, spyOn, test } from 'bun:test';
import * as audio from '../../audio/audio';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import { createTweenPlugin } from 'ecspresso/plugins/scripting/tween';
import { createTimerPlugin } from 'ecspresso/plugins/scripting/timers';
import { createCoroutinePlugin } from 'ecspresso/plugins/scripting/coroutine';
import type { GameEngine } from '../Engine';
import { BOARD_SIZES, type BoardSize } from '../boardGeometry';
import { enemyComponents, mathProblemComponents, playerComponents } from '../entities';
import { gridToPixel } from '../gameUtils';
import { gridCells, type GridCell } from '../lilyPads';
import { GAME_CONFIG } from '../../config';
import { addAISystemToEngine } from './AISystem';
import { addFrogSpriteAnimationSystemToEngine } from './FrogSpriteSystem';
import { registerFrogTongueInit } from './FrogTongueSystem';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import type { AIBehavior, EnemyType } from '../../types/shared';
import type { GameTimer, TimerSlot } from '../types';
import type { EnemyEntity } from '../queries';

async function createTelegraphWorld(enemyType: EnemyType = 'lizard', level = 1, {
	board = BOARD_SIZES.easy,
	start = { x: 1, y: 1 },
	behavior = 'chase',
}: { board?: BoardSize; start?: GridCell; behavior?: AIBehavior } = {}): Promise<{
	world: GameEngine;
	enemy: EnemyEntity;
	player: { id: number };
	timer: GameTimer;
	position: { x: number; y: number };
}> {
	const world = ECSpresso.create<ConfigOf<GameEngine>>()
		.withPlugin(createTimerPlugin<TimerSlot>({ priority: SYSTEM_PRIORITIES.TIMERS }))
		.withPlugin(createTweenPlugin({ priority: SYSTEM_PRIORITIES.ANIMATION }))
		.withPlugin(createCoroutinePlugin({ priority: SYSTEM_PRIORITIES.FROG_TONGUE, phase: 'preUpdate' }))
		.build();
	world.setResource('board', board);
	world.setResource('currentLevel', level);
	addAISystemToEngine(world);
	addFrogSpriteAnimationSystemToEngine(world);
	registerFrogTongueInit(world);
	await world.initialize();
	const playerPosition = gridToPixel(2, 1);
	const player = world.spawn({ ...playerComponents(playerPosition.x, playerPosition.y), timers: {} });
	gridCells(board).forEach(cell => {
		const position = gridToPixel(cell.x, cell.y);
		world.spawn(mathProblemComponents(position.x, position.y, 1, 1));
	});
	const position = gridToPixel(start.x, start.y);
	const spawned = world.spawn({ ...enemyComponents(position.x, position.y, enemyType, behavior), timers: {} });
	const enemy = world.getEntitiesWithQuery(['enemy', 'position', 'timers']).find(entity => entity.id === spawned.id);
	if (!enemy) throw new Error('Telegraph fixture lost its enemy');
	world.update(0);
	const timer = enemy.components.timers.enemyMove;
	if (!timer) throw new Error('Telegraph fixture has no movement timer');
	return { world, enemy, player, timer, position };
}

function advance(world: GameEngine, seconds: number): void {
	const steps = Math.ceil(seconds / 0.01);
	Array.from({ length: steps }).forEach(() => world.update(seconds / steps));
}

describe('enemy movement telegraphs', () => {
	(['lizard', 'spider', 'frog'] as const).forEach(enemyType => {
		test(`${enemyType} turns halfway through the pause and follows that plan after the player moves`, async () => {
			const { world, enemy, player, timer, position } = await createTelegraphWorld(enemyType);
			try {
				advance(world, timer.duration * 0.49);
				expect(enemy.components.enemy.plannedMove).toBeUndefined();
				expect(world.getComponent(enemy.id, enemyType === 'frog' ? 'frogSprite' : 'enemySprite')?.facing).toBe('toward');
				advance(world, timer.duration * 0.02);
				expect(enemy.components.enemy.plannedMove).toEqual({ x: 2, y: 1 });
				expect(world.getComponent(enemy.id, enemyType === 'frog' ? 'frogSprite' : 'enemySprite')?.facing).toBe('right');
				expect(world.hasComponent(enemy.id, 'tween')).toBe(false);
				world.mutateComponent(player.id, 'position', playerPosition => Object.assign(playerPosition, gridToPixel(1, 0)));
				advance(world, timer.duration * 0.47);
				expect(enemy.components.position).toEqual(position);
				expect(enemy.components.enemy.plannedMove).toEqual({ x: 2, y: 1 });
				advance(world, timer.duration * 0.04);
				expect(world.hasComponent(enemy.id, 'tween')).toBe(true);
				expect(world.getComponent(enemy.id, 'spriteAnimation')?.steps).toHaveLength(1);
				advance(world, 0.75);
				expect(enemy.components.position).toEqual(gridToPixel(2, 1));
				advance(world, 0.02);
				expect(enemy.components.enemy.plannedMove).toBeUndefined();
				expect(enemy.components.timers.enemyMove?.active).toBe(true);
			} finally {
				await world.dispose();
			}
		});
	});

	test('a consumed destination cancels the announced move without redirecting', async () => {
		const { world, enemy, timer, position } = await createTelegraphWorld();
		try {
			advance(world, timer.duration * 0.51);
			const targetPosition = gridToPixel(2, 1);
			const problem = world.getEntitiesWithQuery(['mathProblem', 'position'])
				.find(entity => entity.components.position.x === targetPosition.x && entity.components.position.y === targetPosition.y);
			if (!problem) throw new Error('Telegraph fixture has no destination pad');
			world.mutateComponent(problem.id, 'mathProblem', mathProblem => { mathProblem.consumed = true; });
			advance(world, timer.duration * 0.51);
			expect(enemy.components.position).toEqual(position);
			expect(world.hasComponent(enemy.id, 'tween')).toBe(false);
			expect(enemy.components.enemy.plannedMove).toBeUndefined();
		} finally {
			await world.dispose();
		}
	});

	test('other enemies reserve announced destinations across frames', async () => {
		const { world, enemy, timer } = await createTelegraphWorld();
		try {
			advance(world, timer.duration * 0.51);
			const position = gridToPixel(2, 2);
			const second = world.spawn({ ...enemyComponents(position.x, position.y, 'lizard', 'chase'), timers: {} });
			world.update(0);
			const secondTimer = world.getComponent(second.id, 'timers')?.enemyMove;
			if (!secondTimer) throw new Error('Second enemy has no movement timer');
			advance(world, secondTimer.duration * 0.51);
			expect(enemy.components.enemy.plannedMove).toEqual({ x: 2, y: 1 });
			expect(world.getComponent(second.id, 'enemy')?.plannedMove).not.toEqual({ x: 2, y: 1 });
		} finally {
			await world.dispose();
		}
	});

	test('fast levels leave time to finish a reversal before movement', async () => {
		const { world, enemy, timer } = await createTelegraphWorld('lizard', 100);
		try {
			world.mutateComponent(enemy.id, 'enemySprite', sprite => { sprite.facing = 'left'; });
			advance(world, timer.duration * 0.51);
			expect(world.getComponent(enemy.id, 'spriteAnimation')?.steps).toHaveLength(3);
			advance(world, timer.duration * 0.47);
			expect(world.hasComponent(enemy.id, 'spriteAnimation')).toBe(false);
			expect(world.hasComponent(enemy.id, 'tween')).toBe(false);
			advance(world, timer.duration * 0.04);
			expect(world.hasComponent(enemy.id, 'tween')).toBe(true);
			expect(world.getComponent(enemy.id, 'spriteAnimation')?.steps).toHaveLength(1);
		} finally {
			await world.dispose();
		}
	});

	test('a ready tongue attack waits for the announced hop and leaves a fresh pause afterward', async () => {
		const random = spyOn(Math, 'random').mockReturnValue(0.5);
		const sound = spyOn(audio, 'playSound').mockImplementation(() => {});
		const { world, enemy, player } = await createTelegraphWorld('frog');
		try {
			advance(world, 2.3);
			world.mutateComponent(player.id, 'position', position => Object.assign(position, gridToPixel(2, 2)));
			advance(world, 2.7);
			world.mutateComponent(player.id, 'position', position => Object.assign(position, gridToPixel(1, 2)));
			advance(world, 0.6);
			expect(enemy.components.enemy.plannedMove).toEqual({ x: 1, y: 2 });
			expect(world.getComponent(enemy.id, 'frogTongue')?.phase).toBe('idle');
			world.mutateComponent(player.id, 'position', position => Object.assign(position, gridToPixel(0, 2)));
			advance(world, 1.1);
			expect(enemy.components.position).toEqual(gridToPixel(1, 2));
			expect(world.getComponent(enemy.id, 'frogTongue')?.phase).toBe('windingUp');
			expect(enemy.components.timers.enemyMove).toBeUndefined();
			const resumed = Array.from({ length: 400 }).some(() => {
				world.update(0.01);
				return world.getComponent(enemy.id, 'frogTongue')?.phase === 'idle' &&
					enemy.components.timers.enemyMove !== undefined;
			});
			expect(resumed).toBe(true);
			const timer = enemy.components.timers.enemyMove;
			if (!timer) throw new Error('Frog did not resume its movement timer');
			expect(timer.elapsed).toBe(0);
			advance(world, timer.duration * 0.49);
			expect(enemy.components.enemy.plannedMove).toBeUndefined();
		} finally {
			sound.mockRestore();
			random.mockRestore();
			await world.dispose();
		}
	});
});

describe('frog tongue targeting', () => {
	test('an edge frog aims at the player and holds its warning direction after the player moves', async () => {
		const random = spyOn(Math, 'random').mockReturnValue(0.5);
		const sound = spyOn(audio, 'playSound').mockImplementation(() => {});
		const { world, enemy, player, timer } = await createTelegraphWorld('frog', 1, { start: { x: 0, y: 0 } });
		try {
			timer.duration = 100;
			world.mutateComponent(player.id, 'position', position => Object.assign(position, gridToPixel(2, 1)));
			advance(world, 5.6);
			expect(world.getComponent(enemy.id, 'frogTongue')?.phase).toBe('windingUp');
			expect(world.getComponent(enemy.id, 'frogTongue')?.direction).toEqual({ x: 1, y: 0 });
			expect(world.getComponent(enemy.id, 'frogSprite')?.facing).toBe('right');
			world.mutateComponent(player.id, 'position', position => Object.assign(position, gridToPixel(0, 2)));
			advance(world, 1);
			expect(world.getComponent(enemy.id, 'frogTongue')?.direction).toEqual({ x: 1, y: 0 });
			expect(world.getComponent(enemy.id, 'frogTongue')?.segments).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
		} finally {
			sound.mockRestore();
			random.mockRestore();
			await world.dispose();
		}
	});
});

describe('enemy patrol progress', () => {
	Object.entries(BOARD_SIZES).forEach(([difficulty, board]) => {
		const corners = [
			{ x: 0, y: 0 },
			{ x: board.width - 1, y: 0 },
			{ x: 0, y: board.height - 1 },
			{ x: board.width - 1, y: board.height - 1 },
		];
		corners.forEach(start => {
			test(`${difficulty} patrol moves from corner (${start.x}, ${start.y}) on its first cycle`, async () => {
				const { world, enemy, timer, position } = await createTelegraphWorld('lizard', 1, { board, start, behavior: 'patrol' });
				try {
					advance(world, timer.duration * 0.51);
					expect(enemy.components.enemy.plannedMove).not.toEqual(start);
					const waypoints = enemy.components.enemy.waypoints ?? [];
					expect(new Set(waypoints.map(cell => `${cell.x},${cell.y}`)).size).toBe(4);
					advance(world, timer.duration * 0.51 + 0.75);
					expect(enemy.components.position).not.toEqual(position);
				} finally {
					await world.dispose();
				}
			});
		});
	});

	test('reaching a waypoint announces the next step without spending a cycle standing still', async () => {
		const { world, enemy, timer, position } = await createTelegraphWorld('spider', 1, { behavior: 'patrol' });
		try {
			world.mutateComponent(enemy.id, 'enemy', data => {
				data.waypoints = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }];
				data.currentWaypoint = 0;
			});
			advance(world, timer.duration * 0.51);
			expect(enemy.components.enemy.plannedMove).toEqual({ x: 2, y: 1 });
			advance(world, timer.duration * 0.51 + 0.75);
			expect(enemy.components.position).not.toEqual(position);
			const nextTimer = enemy.components.timers.enemyMove;
			if (!nextTimer) throw new Error('Patrol did not start its next cycle');
			advance(world, nextTimer.duration * 0.51);
			expect(enemy.components.enemy.plannedMove).toEqual({ x: 2, y: 2 });
		} finally {
			await world.dispose();
		}
	});
});

describe('lizard guard progress', () => {
	[false, true].forEach(consumeReturnPad => {
		test(consumeReturnPad
			? 'relocates its guard area when consumed pads leave only outward moves'
			: 'chooses an available move inside its guard area instead of rejecting an outward move', async () => {
			const random = spyOn(Math, 'random').mockReturnValue(0);
			const { world, enemy, timer, position } = await createTelegraphWorld('lizard', 1, {
				start: { x: 2, y: 0 }, behavior: 'guard',
			});
			try {
				world.mutateComponent(enemy.id, 'enemy', data => { data.guardPosition = { x: 0, y: 0 }; });
				if (consumeReturnPad) {
					const returnPosition = gridToPixel(1, 0);
					const problem = world.getEntitiesWithQuery(['mathProblem', 'position'])
						.find(entity => entity.components.position.x === returnPosition.x && entity.components.position.y === returnPosition.y);
					if (!problem) throw new Error('Guard fixture has no return pad');
					world.mutateComponent(problem.id, 'mathProblem', data => { data.consumed = true; });
				}
				const target = consumeReturnPad ? { x: 2, y: 1 } : { x: 1, y: 0 };
				advance(world, timer.duration * 0.51);
				expect(enemy.components.enemy.plannedMove).toEqual(target);
				expect(enemy.components.enemy.guardPosition).toEqual(consumeReturnPad ? { x: 2, y: 0 } : { x: 0, y: 0 });
				expect(enemy.components.position).toEqual(position);
				advance(world, timer.duration * 0.51 + 0.75);
				expect(enemy.components.position).toEqual(gridToPixel(target.x, target.y));
			} finally {
				random.mockRestore();
				await world.dispose();
			}
		});
	});
});

describe('AI board bounds', () => {
	Object.entries(BOARD_SIZES).forEach(([difficulty, board]) => {
		test(`${difficulty} keeps all AI behaviors and patrol waypoints inside the active board`, async () => {
			await Promise.all((['chase', 'patrol', 'random', 'guard'] as const).map(async behavior => {
				const world = ECSpresso.create<ConfigOf<GameEngine>>()
					.withPlugin(createTimerPlugin<TimerSlot>({ priority: SYSTEM_PRIORITIES.TIMERS }))
					.withPlugin(createTweenPlugin({ priority: SYSTEM_PRIORITIES.ANIMATION }))
					.build();
				world.setResource('board', board);
				world.setResource('currentLevel', 1);
				addAISystemToEngine(world);
				addFrogSpriteAnimationSystemToEngine(world);
				await world.initialize();
				const playerPosition = gridToPixel(0, 0);
				world.spawn({ ...playerComponents(playerPosition.x, playerPosition.y), timers: {} });
				gridCells(board).forEach(cell => {
					const position = gridToPixel(cell.x, cell.y);
					world.spawn(mathProblemComponents(position.x, position.y, 1, 1));
				});
				const position = gridToPixel(board.width - 1, board.height - 1);
				world.spawn({ ...enemyComponents(position.x, position.y, 'lizard', behavior), timers: {} });
				world.update(0.01);
				advance(world, 8);
				const enemy = world.getEntitiesWithQuery(['enemy', 'position'])[0];
				if (!enemy) throw new Error('AI fixture lost its enemy');
				expect(enemy.components.position.x).toBeGreaterThanOrEqual(0);
				expect(enemy.components.position.y).toBeGreaterThanOrEqual(0);
				expect(enemy.components.position.x).toBeLessThan(board.width * GAME_CONFIG.GRID.CELL_SIZE);
				expect(enemy.components.position.y).toBeLessThan(board.height * GAME_CONFIG.GRID.CELL_SIZE);
				expect((enemy.components.enemy.waypoints ?? []).every(cell => cell.x < board.width && cell.y < board.height)).toBe(true);
				await world.dispose();
			}));
		});
	});
});

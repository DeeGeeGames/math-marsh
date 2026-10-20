import { BOARD_SIZES, type BoardSize } from '../boardGeometry';
import { describe, expect, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import { createTimer, createTimerPlugin } from 'ecspresso/plugins/scripting/timers';
import { GAME_CONFIG } from '../../config';
import type { GameEngine } from '../Engine';
import type { TimerSlot } from '../types';
import { configureGameScreens } from '../screenConfiguration';
import type { EnemyType } from '../../types/shared';
import { enemyRosterForLevel } from '../enemyRosters';
import { enemyComponents, mathProblemComponents, playerComponents } from '../entities';
import { gridToPixel } from '../gameUtils';
import { gridCells } from '../lilyPads';
import { addEnemySpawnSystemToEngine } from './EnemySpawnSystem';

type TestConfig = Omit<ConfigOf<GameEngine>, 'screens' | 'resources'> & {
  screens: {};
  resources: Omit<ConfigOf<GameEngine>['resources'], '$screen'>;
};

async function createSpawnWorld(level: number, roster: readonly EnemyType[], board: BoardSize): Promise<GameEngine> {
  const world = ECSpresso.create<TestConfig>()
    .withPlugin(createTimerPlugin<TimerSlot>())
    .withScreens(configureGameScreens)
    .build();
  world.setResource('currentLevel', level);
  world.setResource('board', board);
  world.setResource('enemySpawn', { index: 0, roster });
  addEnemySpawnSystemToEngine(world.systemScope({ inScreens: ['playing'] }));
  await world.initialize();
  await world.setScreen('playing', { level, isFreshGame: false });
  const playerPosition = gridToPixel(Math.floor(board.width / 2), Math.floor(board.height / 2));
  world.spawn({ ...playerComponents(playerPosition.x, playerPosition.y), timers: {} });
  gridCells(board).forEach(cell => {
    const position = gridToPixel(cell.x, cell.y);
    world.spawn(mathProblemComponents(position.x, position.y, 1, 1));
  });
  return world;
}

describe('enemy roster spawning', () => {
  test('Easy spawns only its rotating single enemy on a 3x3 board', async () => {
    await Promise.all([1, 2, 3, 12].map(async level => {
      const roster = enemyRosterForLevel(level, 'easy');
      const world = await createSpawnWorld(level, roster, BOARD_SIZES.easy);
      world.update(0.01);
      world.update(30);
      const enemies = world.getEntitiesWithQuery(['enemy', 'position']);
      expect(enemies.map(enemy => enemy.components.enemy.enemyType)).toEqual([...roster]);
      expect(enemies.every(enemy => enemy.components.position.x < 318 && enemy.components.position.y < 318)).toBe(true);
      await world.dispose();
    }));
  });
  test('spawns all five lizards with timed gaps and never restarts an exhausted roster', async () => {
    const roster = enemyRosterForLevel(5, 'expert');
    const world = await createSpawnWorld(5, roster, BOARD_SIZES.expert);
    world.update(0.01);
    expect(world.getEntitiesWithQuery(['enemy'])).toHaveLength(1);
    world.update(0.1);
    expect(world.getEntitiesWithQuery(['enemy'])).toHaveLength(1);
    Array.from({ length: 4 }).forEach(() => world.update(3));
    expect(world.getEntitiesWithQuery(['enemy']).map(entity => entity.components.enemy.enemyType)).toEqual([...roster]);
    expect(world.getResource('enemySpawn')).toEqual({ index: 5, roster });
    world.getEntitiesWithQuery(['enemy']).forEach(entity => world.removeEntity(entity.id));
    world.update(30);
    world.update(30);
    expect(world.getEntitiesWithQuery(['enemy'])).toHaveLength(0);
    await world.dispose();
  });

  test('a blocked spawn preserves the next roster entry and retries when a pad is available', async () => {
    const world = await createSpawnWorld(3, ['frog'], BOARD_SIZES.expert);
    world.getEntitiesWithQuery(['mathProblem']).forEach(entity => world.removeEntity(entity.id));
    world.update(0.01);
    expect(world.getResource('enemySpawn').index).toBe(0);
    expect(world.getEntitiesWithQuery(['enemy'])).toHaveLength(0);
    const position = gridToPixel(0, 0);
    world.spawn(mathProblemComponents(position.x, position.y, 1, 1));
    world.update(2);
    expect(world.getResource('enemySpawn').index).toBe(1);
    expect(world.getEntitiesWithQuery(['enemy']).map(entity => entity.components.enemy.enemyType)).toEqual(['frog']);
    await world.dispose();
  });

  test('roster spawning reserves active enemies announced destinations', async () => {
    const world = await createSpawnWorld(1, ['frog'], BOARD_SIZES.easy);
    try {
      world.getEntitiesWithQuery(['mathProblem']).forEach(entity => world.removeEntity(entity.id));
      const onlyPad = gridToPixel(1, 0);
      world.spawn(mathProblemComponents(onlyPad.x, onlyPad.y, 1, 1));
      const current = gridToPixel(0, 0);
      const blocker = world.spawn({
        ...enemyComponents(current.x, current.y, 'lizard', 'guard'),
        timers: {},
      });
      world.mutateComponent(blocker.id, 'enemy', enemy => {
        enemy.plannedMove = { x: 1, y: 0 };
      });

      world.update(0.01);
      expect(world.getResource('enemySpawn').index).toBe(0);
      expect(world.getEntitiesWithQuery(['enemy']).map(entity => entity.components.enemy.enemyType))
        .toEqual(['lizard']);

      world.mutateComponent(blocker.id, 'enemy', enemy => {
        delete enemy.plannedMove;
      });
      world.update(2);
      const enemies = world.getEntitiesWithQuery(['enemy', 'position']);
      expect(world.getResource('enemySpawn').index).toBe(1);
      expect(enemies.map(entity => entity.components.enemy.enemyType).sort()).toEqual(['frog', 'lizard']);
      expect(enemies.find(entity => entity.components.enemy.enemyType === 'frog')?.components.position)
        .toMatchObject(onlyPad);
    } finally {
      await world.dispose();
    }
  });

  test('respawn retries a reserved pad and ignores an eliminating enemy stale destination', async () => {
    const world = await createSpawnWorld(1, [], BOARD_SIZES.easy);
    try {
      world.getEntitiesWithQuery(['mathProblem']).forEach(entity => world.removeEntity(entity.id));
      const onlyPad = gridToPixel(1, 0);
      world.spawn(mathProblemComponents(onlyPad.x, onlyPad.y, 1, 1));

      const current = gridToPixel(0, 0);
      const blocker = world.spawn({
        ...enemyComponents(current.x, current.y, 'lizard', 'guard'),
        timers: {},
      });
      world.mutateComponent(blocker.id, 'enemy', enemy => {
        enemy.plannedMove = { x: 1, y: 0 };
      });

      const eliminatedPosition = gridToPixel(2, 2);
      const eliminated = world.spawn({
        ...enemyComponents(eliminatedPosition.x, eliminatedPosition.y, 'spider', 'guard'),
        timers: { enemyRespawn: createTimer(0) },
        enemyElimination: { deathScale: 0 },
      });
      world.mutateComponent(eliminated.id, 'enemy', enemy => {
        enemy.plannedMove = { x: 1, y: 0 };
      });

      world.update(0.01);
      expect(world.getEntity(eliminated.id)).toBeDefined();
      expect(world.getEntitiesWithQuery(['enemy'])
        .filter(entity => !world.hasComponent(entity.id, 'enemyElimination')))
        .toHaveLength(1);
      expect(world.getComponent(eliminated.id, 'timers')?.enemyRespawn?.duration)
        .toBe(GAME_CONFIG.TIMING.SHORT_DELAY / 1000);

      world.removeEntity(blocker.id);
      world.update(1);
      const returned = world.getEntitiesWithQuery(['enemy', 'position'])
        .filter(entity => !world.hasComponent(entity.id, 'enemyElimination'));
      expect(world.getEntity(eliminated.id)).toBeUndefined();
      expect(returned).toHaveLength(1);
      expect(returned[0]?.components.enemy.enemyType).toBe('spider');
      expect(returned[0]?.components.position).toMatchObject(onlyPad);
    } finally {
      await world.dispose();
    }
  });

  test('simultaneous respawns reserve each selected pad for the next returning enemy', async () => {
    const world = await createSpawnWorld(1, [], BOARD_SIZES.easy);
    try {
      const returningTypes = ['frog', 'spider'] as const;
      returningTypes.forEach((enemyType, index) => {
        const position = gridToPixel(index, 0);
        world.spawn({
          ...enemyComponents(position.x, position.y, enemyType, 'guard'),
          timers: { enemyRespawn: createTimer(0) },
          enemyElimination: { deathScale: 0 },
        });
      });

      world.update(0.01);
      const player = world.getEntitiesWithQuery(['player', 'position'])[0];
      if (!player) throw new Error('Spawn fixture has no player');
      const activeEnemies = world.getEntitiesWithQuery(['enemy', 'position'])
        .filter(entity => !world.hasComponent(entity.id, 'enemyElimination'));
      const occupiedPositions = [player.components.position, ...activeEnemies.map(enemy => enemy.components.position)]
        .map(position => `${position.x},${position.y}`);
      expect(activeEnemies).toHaveLength(2);
      expect(activeEnemies.map(enemy => enemy.components.enemy.enemyType).sort()).toEqual(['frog', 'spider']);
      expect(new Set(occupiedPositions).size).toBe(3);
    } finally {
      await world.dispose();
    }
  });
});

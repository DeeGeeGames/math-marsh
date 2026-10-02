import { BOARD_SIZES, type BoardSize } from '../boardGeometry';
import { describe, expect, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import { createTimerPlugin } from 'ecspresso/plugins/scripting/timers';
import type { GameEngine } from '../Engine';
import type { TimerSlot } from '../types';
import type { EnemyType } from '../../types/shared';
import { enemyRosterForLevel } from '../enemyRosters';
import { mathProblemComponents, playerComponents } from '../entities';
import { gridToPixel } from '../gameUtils';
import { gridCells } from '../lilyPads';
import { addEnemySpawnSystemToEngine } from './EnemySpawnSystem';

async function createSpawnWorld(level: number, roster: readonly EnemyType[], board: BoardSize): Promise<GameEngine> {
  const world = ECSpresso.create<ConfigOf<GameEngine>>()
    .withPlugin(createTimerPlugin<TimerSlot>())
    .build();
  world.setResource('currentLevel', level);
  world.setResource('board', board);
  world.setResource('enemySpawn', { index: 0, roster });
  addEnemySpawnSystemToEngine(world);
  await world.initialize();
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
});

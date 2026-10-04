import { describe, expect, spyOn, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import type { GameEngine } from '../Engine';
import { playerComponents } from '../entities';
import { gridToPixel } from '../gameUtils';
import { flyMoveSide, flyMoveToward, flyTurnTowardSide } from '../assets';
import { addFrogSpriteAnimationSystemToEngine } from './FrogSpriteSystem';
import { addPlayerSpriteSystemToEngine, nextPlayerSpriteElapsed, playerTurnSteps } from './PlayerSpriteSystem';

describe('player sprite animation', () => {
  test('continues flying from the first frame', () => {
    expect(nextPlayerSpriteElapsed(0, 1 / 24)).toBe(1 / 24);
  });

  test('loops after the eighth frame', () => {
    expect(nextPlayerSpriteElapsed(7 / 24, 1 / 24)).toBeCloseTo(0);
  });

  test('every direction change animates, with a constant total turn duration', () => {
    const facings = ['toward', 'away', 'left', 'right'] as const;
    for (const from of facings) {
      for (const to of facings) {
        const steps = playerTurnSteps(from, to);
        expect(steps.length).toBe(from === to ? 0 : (from === 'left' && to === 'right'
          || from === 'right' && to === 'left'
          || from === 'toward' && to === 'away'
          || from === 'away' && to === 'toward') ? 2 : 1);
        expect(steps.reduce((sum, step) => sum + step.duration, 0)).toBe(from === to ? 0 : 0.18);
      }
    }
  });

  test('plays intermediate frames, finishes before retargeting, and resumes flight', async () => {
    const world = ECSpresso.create<ConfigOf<GameEngine>>().build();
    // Supply the gameplay screen gate without bootstrapping the DOM screen UI.
    const addSystem = world.addSystem.bind(world);
    const screen = spyOn(world, 'addSystem').mockImplementation(label => {
      const system = addSystem(label);
      spyOn(system, 'inScreens').mockReturnValue(system);
      return system;
    });
    addPlayerSpriteSystemToEngine(world);
    addFrogSpriteAnimationSystemToEngine(world);
    await world.initialize();
    const position = gridToPixel(1, 1);
    const player = world.spawn(playerComponents(position.x, position.y));
    try {
      world.mutateComponent(player.id, 'pathFollower', path => {
        path.breadcrumbs = [{ x: 2, y: 1 }];
      });
      world.update(0);
      expect(world.getComponent(player.id, 'renderable')?.imageSrc).toBe(flyTurnTowardSide);
      world.update(0.08);
      expect(world.getComponent(player.id, 'renderable')?.spriteSheet?.frameIndex).toBeGreaterThan(0);
      world.mutateComponent(player.id, 'pathFollower', path => {
        path.breadcrumbs = [{ x: 1, y: 2 }];
      });
      world.update(0.02);
      expect(world.getComponent(player.id, 'playerSprite')?.facing).toBe('right');
      world.update(0.09);
      world.update(0);
      expect(world.getComponent(player.id, 'playerSprite')?.facing).toBe('toward');
      expect(world.getComponent(player.id, 'spriteAnimation')?.steps[0]?.reverse).toBe(true);
      world.update(0.19);
      world.update(0.01);
      expect(world.hasComponent(player.id, 'spriteAnimation')).toBe(false);
      expect(world.getComponent(player.id, 'renderable')?.imageSrc).toBe(flyMoveToward);
      expect(world.getComponent(player.id, 'position')).toEqual({ ...position, rotation: 0 });
      world.mutateComponent(player.id, 'pathFollower', path => {
        path.breadcrumbs = [{ x: 0, y: 1 }];
      });
      world.update(0);
      expect(world.getComponent(player.id, 'renderable')?.spriteSheet?.flipX).toBe(true);
      world.update(0.19);
      world.update(0.01);
      expect(world.getComponent(player.id, 'renderable')?.imageSrc).toBe(flyMoveSide);
      expect(world.getComponent(player.id, 'renderable')?.spriteSheet?.flipX).toBe(true);
    } finally {
      screen.mockRestore();
      await world.dispose();
    }
  });
});

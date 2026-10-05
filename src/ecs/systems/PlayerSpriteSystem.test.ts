import { describe, expect, spyOn, test } from 'bun:test';
import ECSpresso, { type ConfigOf } from 'ecspresso';
import type { GameEngine } from '../Engine';
import { playerComponents } from '../entities';
import { gridToPixel } from '../gameUtils';
import { flyMoveAway, flyEatSide, flyEatToward, flyMoveSide, flyMoveToward, flyTurnTowardSide } from '../assets';
import { addShakeSystemToEngine } from './AnimationSystem';
import { addFrogSpriteAnimationSystemToEngine } from './FrogSpriteSystem';
import { addPlayerSpriteSystemToEngine, nextPlayerSpriteElapsed, playerTurnSteps, startPlayerEatingAnimation } from './PlayerSpriteSystem';

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

  test('eats once in every facing, replaces an active turn, and resumes flight', async () => {
    const world = ECSpresso.create<ConfigOf<GameEngine>>().build();
    const addSystem = world.addSystem.bind(world);
    const screen = spyOn(world, 'addSystem').mockImplementation(label => {
      const system = addSystem(label);
      spyOn(system, 'inScreens').mockReturnValue(system);
      return system;
    });
    addPlayerSpriteSystemToEngine(world);
    addShakeSystemToEngine(world);
    addFrogSpriteAnimationSystemToEngine(world);
    await world.initialize();
    const position = gridToPixel(1, 1);
    try {
      for (const facing of ['toward', 'away', 'left', 'right'] as const) {
        const player = world.spawn(playerComponents(position.x, position.y));
        world.mutateComponent(player.id, 'playerSprite', sprite => { sprite.facing = facing; });
        world.addComponent(player.id, 'spriteAnimation', {
          elapsed: 0, duration: 0.18, currentStep: 0,
          steps: playerTurnSteps('toward', 'right'),
        });
        startPlayerEatingAnimation(world, player.id);
        world.update(0);
        const image = facing === 'toward' ? flyEatToward : facing === 'away' ? flyMoveAway : flyEatSide;
        expect(world.getComponent(player.id, 'renderable')?.imageSrc).toBe(image);
        expect(world.getComponent(player.id, 'renderable')?.spriteSheet?.flipX).toBe(facing === 'left');
        expect(world.getComponent(player.id, 'shake')?.intensity).toBe(facing === 'away' ? 2 : undefined);
        world.update(1 / 12 + 0.001);
        expect(world.getComponent(player.id, 'renderable')?.spriteSheet?.frameIndex).toBe(facing === 'away' ? 1 : 0);
        world.update(0.36 - (1 / 12 + 0.001));
        const shake = world.getComponent(player.id, 'shake');
        if (facing === 'away') {
          expect(shake?.duration).toBe(0.72);
          expect(Math.abs(shake?.offsetX ?? Infinity)).toBeLessThanOrEqual(1);
          expect(Math.abs(shake?.offsetY ?? Infinity)).toBeLessThanOrEqual(1);
        }
        expect(world.getComponent(player.id, 'renderable')?.spriteSheet?.frameIndex).toBe(4);
        expect(world.getComponent(player.id, 'playerSprite')?.facing).toBe(facing);
        world.update(0.34);
        expect(world.getComponent(player.id, 'renderable')?.spriteSheet?.frameIndex).toBe(facing === 'away' ? 0 : 7);
        world.update(0.03);
        expect(world.hasComponent(player.id, 'spriteAnimation')).toBe(false);
        expect(world.hasComponent(player.id, 'shake')).toBe(false);
        world.update(0.01);
        if (facing === 'away') {
          expect(world.getComponent(player.id, 'renderable')?.imageSrc).toBe(flyMoveAway);
        } else {
          expect(world.getComponent(player.id, 'renderable')?.imageSrc).not.toBe(image);
        }
        expect(world.getComponent(player.id, 'position')).toEqual({ ...position, rotation: 0 });
        world.removeEntity(player.id);
      }
    } finally {
      screen.mockRestore();
      await world.dispose();
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
    addShakeSystemToEngine(world);
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

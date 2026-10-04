import { GAME_CONFIG } from '../../config';
import type { GameSystemRegistrar } from '../Engine';
import type { AllComponents } from '../types';
import { flyMoveAway, flyMoveSide, flyMoveToward, flyTurnSideAway, flyTurnTowardSide } from '../assets';
import { gridToPixel } from '../gameUtils';
import { SYSTEM_PRIORITIES } from '../systemConfigs';

type Facing = AllComponents['playerSprite']['facing'];
type SpriteStep = AllComponents['spriteAnimation']['steps'][number];

const FRAME_COUNT = 8;
const FRAME_DURATION_S = 1 / 24;
const ANIMATION_DURATION_S = FRAME_COUNT * FRAME_DURATION_S;
const TURN_DURATION_S = 0.18;

// Opposite facings pass through a shared view instead of flipping instantly.
export const playerTurnSteps = function(from: Facing, to: Facing): SpriteStep[] {
  if (from === to) return [];
  const fromSide = from === 'left' || from === 'right';
  const toSide = to === 'left' || to === 'right';
  if (fromSide === toSide) {
    const bridge = fromSide ? 'toward' : 'right';
    return [...playerTurnSteps(from, bridge), ...playerTurnSteps(bridge, to)]
      .map(step => ({ ...step, duration: TURN_DURATION_S / 2 }));
  }
  const depth = fromSide ? to : from;
  const side = fromSide ? from : to;
  return [{
    imageSrc: depth === 'toward' ? flyTurnTowardSide : flyTurnSideAway,
    frameCount: FRAME_COUNT,
    duration: TURN_DURATION_S,
    flipX: side === 'left',
    reverse: depth === 'toward' ? fromSide : toSide,
  }];
};

const SPRITE_BY_FACING = {
  toward: { imageSrc: flyMoveToward, flipX: false },
  away: { imageSrc: flyMoveAway, flipX: false },
  left: { imageSrc: flyMoveSide, flipX: true },
  right: { imageSrc: flyMoveSide, flipX: false },
} as const satisfies Record<Facing, { imageSrc: string; flipX: boolean }>;

const facingFromDelta = (dx: number, dy: number): Facing | undefined => {
  if (dx === 0 && dy === 0) return undefined;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'away' : 'toward';
};

export function defaultPlayerRenderable(): AllComponents['renderable'] {
  return {
    shape: 'image',
    color: GAME_CONFIG.COLORS.PLAYER,
    size: GAME_CONFIG.GRID.CELL_SIZE * GAME_CONFIG.SIZES.PLAYER,
    layer: GAME_CONFIG.LAYERS.PLAYER,
    imageSrc: flyMoveToward,
    spriteSheet: {
      frameCount: FRAME_COUNT,
      frameIndex: 0,
    },
  };
}

export function defaultPlayerSprite(): AllComponents['playerSprite'] {
  return {
    facing: 'toward',
    elapsed: 0,
  };
}

export function nextPlayerSpriteElapsed(elapsed: number, dt: number): number {
  return (elapsed + dt) % ANIMATION_DURATION_S;
}

export function addPlayerSpriteSystemToEngine(systems: GameSystemRegistrar): void {
  systems.addSystem('playerSpriteSystem')
    .inGroup('gameplay')
    .setPriority(SYSTEM_PRIORITIES.ANIMATION)
    .inScreens(['playing', 'tutorial'])
    .setProcessEach(
      {
        with: ['pathFollower', 'player', 'playerSprite', 'position', 'renderable'],
        optional: ['spriteAnimation'],
        mutates: ['playerSprite', 'renderable'],
      } as const,
      ({ entity, dt, ecs }) => {
        const { pathFollower, player, playerSprite, position, renderable } = entity.components;
        if (player.gameOverPending) return;
        // The shared sprite animation system owns the renderable during a turn.
        // Finish that turn before responding to the latest movement direction.
        if (entity.components.spriteAnimation) return;

        const targetGrid = pathFollower.breadcrumbs[0] ?? {
          x: pathFollower.anchorGridX,
          y: pathFollower.anchorGridY,
        };
        const target = gridToPixel(targetGrid.x, targetGrid.y);
        const facing = facingFromDelta(target.x - position.x, target.y - position.y);
        if (facing && facing !== playerSprite.facing) {
          const steps = playerTurnSteps(playerSprite.facing, facing);
          const first = steps[0];
          if (!first) return;
          playerSprite.facing = facing;
          playerSprite.elapsed = 0;
          renderable.imageSrc = first.imageSrc;
          renderable.spriteSheet = {
            frameCount: first.frameCount,
            frameIndex: first.reverse ? FRAME_COUNT - 1 : 0,
            flipX: first.flipX,
          };
          ecs.commands.addComponent(entity.id, 'spriteAnimation', {
            elapsed: 0,
            duration: TURN_DURATION_S,
            currentStep: 0,
            steps,
          });
          return;
        }

        playerSprite.elapsed = nextPlayerSpriteElapsed(playerSprite.elapsed, dt);

        const presentation = SPRITE_BY_FACING[playerSprite.facing];
        renderable.imageSrc = presentation.imageSrc;
        renderable.spriteSheet = {
          frameCount: FRAME_COUNT,
          frameIndex: Math.floor(playerSprite.elapsed / FRAME_DURATION_S),
          flipX: presentation.flipX,
        };
      },
    );
}

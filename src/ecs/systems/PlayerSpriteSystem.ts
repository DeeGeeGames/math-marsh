import { GAME_CONFIG } from '../../config';
import { gameEngine } from '../Engine';
import type { AllComponents } from '../types';
import { flyMoveAway, flyMoveSide, flyMoveToward } from '../assets';
import { gridToPixel } from '../gameUtils';
import { activeLilyPadCellKeys, isActiveLilyPadCell, positionGridCell } from '../lilyPads';
import { mathProblemQuery } from '../queries';
import { SYSTEM_PRIORITIES } from '../systemConfigs';

type Facing = AllComponents['playerSprite']['facing'];

const FRAME_COUNT = 8;
const FRAME_DURATION_S = 1 / 24;
const ANIMATION_DURATION_S = FRAME_COUNT * FRAME_DURATION_S;

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

export function shouldPlayerFlap(
  speed: number,
  position: Readonly<{ x: number; y: number }>,
  activeLilyPadCells: ReadonlySet<string>,
): boolean {
  return speed > 0 || !isActiveLilyPadCell(positionGridCell(position), activeLilyPadCells);
}

export function addPlayerSpriteSystemToEngine(): void {
  gameEngine.addSystem('playerSpriteSystem')
    .setPriority(SYSTEM_PRIORITIES.ANIMATION)
    .inScreens(['playing', 'tutorial'])
    .addQuery('players', {
      with: ['pathFollower', 'player', 'playerSprite', 'position', 'renderable'],
      mutates: ['playerSprite', 'renderable'],
    } as const)
    .addQuery('mathProblems', mathProblemQuery)
    .setProcess(({ queries, dt }) => {
      const activeLilyPadCells = activeLilyPadCellKeys(queries.mathProblems);

      queries.players.forEach(entity => {
        const { pathFollower, player, playerSprite, position, renderable } = entity.components;
        if (player.gameOverPending) return;

        const targetGrid = pathFollower.breadcrumbs[0] ?? {
          x: pathFollower.anchorGridX,
          y: pathFollower.anchorGridY,
        };
        const target = gridToPixel(targetGrid.x, targetGrid.y);
        const facing = facingFromDelta(target.x - position.x, target.y - position.y);
        if (facing) playerSprite.facing = facing;

        playerSprite.elapsed = shouldPlayerFlap(pathFollower.speed, position, activeLilyPadCells)
          ? (playerSprite.elapsed + dt) % ANIMATION_DURATION_S
          : 0;

        const presentation = SPRITE_BY_FACING[playerSprite.facing];
        renderable.imageSrc = presentation.imageSrc;
        renderable.spriteSheet = {
          frameCount: FRAME_COUNT,
          frameIndex: Math.floor(playerSprite.elapsed / FRAME_DURATION_S),
          flipX: presentation.flipX,
        };
      });
    });
}

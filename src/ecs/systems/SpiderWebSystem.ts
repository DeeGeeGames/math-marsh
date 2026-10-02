import type { GameEngine } from '../Engine';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { GAME_CONFIG } from '../../config';
import { gridToPixel } from '../gameUtils';
import { SPIDER_WEB_BUILD_DURATION_MS } from '../systemConfigs';

const SPIDER_CONFIG = GAME_CONFIG.ENEMY_TYPES.spider;

export function createSpiderWeb(ecs: GameEngine, gridX: number, gridY: number): void {
  const board = ecs.getResource('board');
  if (gridX < 0 || gridX >= board.width || gridY < 0 || gridY >= board.height) {
    console.error(`🕸️ ERROR: Grid coordinates (${gridX}, ${gridY}) outside bounds (0,0) to (${board.width-1},${board.height-1})`);
    return;
  }

  const { x: pixelX, y: pixelY } = gridToPixel(gridX, gridY);

  ecs.commands.spawn({
    position: { x: pixelX, y: pixelY },
    spiderWeb: { freezeTime: SPIDER_CONFIG.FREEZE_DURATION },
    renderable: {
      shape: 'rectangle',
      color: 'rgba(128, 0, 128, 0.3)',
      size: GAME_CONFIG.GRID.CELL_SIZE * 0.8,
      layer: 1,
    },
    collider: {
      width: GAME_CONFIG.GRID.CELL_SIZE,
      height: GAME_CONFIG.GRID.CELL_SIZE,
      group: 'spiderWeb',
    },
    timers: {
      webBuild: createTimer(SPIDER_WEB_BUILD_DURATION_MS / 1000),
      webExpiry: createTimer(SPIDER_CONFIG.WEB_DURATION / 1000, {
        onComplete: ({ entityId }) => {
          console.log(`🕸️ Spider web expired without catching a player`);
          ecs.commands.removeEntity(entityId);
        },
      }),
    },
  });

  console.log(`🕸️ Created spider web at grid (${gridX}, ${gridY})`);
}

import { gameEngine } from '../Engine';
import { GAME_CONFIG } from '../../config';
import {
  renderableEntityQuery,
  playerQuery,
  mathProblemQuery,
  frogTongueQuery,
  spiderWebQuery,
  enemyQuery,
} from '../queries';
import { collectGridCellKeys } from '../lilyPads';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { cleanupRenderSystem, getCtx, renderMargins } from './render/context';
import { drawGrid } from './render/grid';
import { drawEntity } from './render/entities';
import {
  drawAnswerConsumptionEffects,
  drawEquationSelectionHighlights,
  drawPlayerHighlight,
  drawMathProblemLilyPads,
  drawMathProblemNumbers,
} from './render/mathProblems';
import { drawEnhancedSpiderWebs } from './render/spiderWebs';
import { drawEnhancedFrogTongues, drawFrogAttackTelegraphs } from './render/frogTongues';
import { drawFrozenPlayerEffect } from './render/frozenPlayer';
import { drawBoardObjective } from './render/objective';
import { getCachedImage } from './render/images';
import { IMAGE_ASSET_KEYS } from '../assets';
import { drawLevelCompleteCelebration } from './render/levelComplete';
import {
  drawEnemySpawnTelegraphs,
  enemyEmergencePresentation,
} from './render/enemyTelegraphs';
import { drawDamageFeedback } from './render/damageFeedback';

export { initializeRenderSystem } from './render/context';

const reducedMotionPreference = typeof window === 'undefined'
  ? undefined
  : window.matchMedia('(prefers-reduced-motion: reduce)');

export const addRenderSystemToEngine = (): void => {
  gameEngine.addSystem('renderSystem')
    .setPriority(SYSTEM_PRIORITIES.RENDER)
    .inScreens(['playing', 'tutorial', 'levelComplete'])
    .requiresAssets(IMAGE_ASSET_KEYS)
    .addQuery('renderableEntities', { ...renderableEntityQuery, optional: ['shake'] } as const)
    .addSingleton('player', { ...playerQuery, optional: ['shake'] } as const)
    .addQuery('mathProblems', mathProblemQuery)
    .addQuery('enemies', enemyQuery)
    .addQuery('frogTongues', frogTongueQuery)
    .addQuery('spiderWebs', spiderWebQuery)
    .withResources(['equationMode'])
    .setOnDetach(cleanupRenderSystem)
    .setProcess(({ queries, ecs, resources: { equationMode } }) => {
      const ctx = getCtx();
      if (!ctx) return;

      const currentTime = performance.now();
      const margins = renderMargins();
      const enemyOccupiedCells = collectGridCellKeys(queries.enemies);
      const reducedMotion = reducedMotionPreference?.matches === true;

      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      const answerTargets = drawBoardObjective(
        ctx,
        equationMode,
        queries.mathProblems,
        margins.top,
        currentTime,
      );
      ctx.save();
      ctx.translate(margins.left, margins.top);

      const ambientTime = reducedMotion ? 0 : currentTime;
      const playerShake = queries.player?.components.shake;
      const boardShakeScale = reducedMotion ? 0 : 0.28;

      ctx.translate(
        (playerShake?.offsetX ?? 0) * boardShakeScale,
        (playerShake?.offsetY ?? 0) * boardShakeScale,
      );

      drawGrid(ctx, ambientTime);

      const sortedEntities = [...queries.renderableEntities].sort(
        (a, b) => a.components.renderable.layer - b.components.renderable.layer,
      );

      const drawRenderableEntity = (entity: (typeof sortedEntities)[number]): void => {
        const timers = 'timers' in entity.components ? entity.components.timers : undefined;
        const playerComp = 'player' in entity.components ? entity.components.player : undefined;
        const renderable = entity.components.renderable;
        const shake = entity.components.shake;
        const image = renderable.imageSrc
          ? getCachedImage(ecs, renderable.imageSrc)
          : undefined;
        const emergence = enemyEmergencePresentation(timers?.enemySpawnTelegraph);

        drawEntity(ctx, {
          position: entity.components.position,
          renderable,
          image,
          isInvulnerable: timers?.invulnerability?.active === true,
          deathScale: playerComp?.deathScale ?? 1.0,
          shakeOffsetX: shake?.offsetX ?? 0,
          shakeOffsetY: shake?.offsetY ?? 0,
          opacity: emergence.opacity,
          visualScale: emergence.scale,
        });
      };

      for (const entity of sortedEntities) {
        if ('mathProblem' in entity.components) continue;
        if (entity.components.renderable.layer >= GAME_CONFIG.LAYERS.ENTITIES) continue;
        drawRenderableEntity(entity);
      }

      drawMathProblemLilyPads(ctx, queries.mathProblems, ambientTime);
      drawEnemySpawnTelegraphs(ctx, queries.enemies, currentTime, reducedMotion);
      drawPlayerHighlight(ctx, queries.player, queries.mathProblems, enemyOccupiedCells, ambientTime);
      drawEnhancedSpiderWebs(ctx, queries.spiderWebs, currentTime, reducedMotion);
      drawMathProblemNumbers(ctx, queries.mathProblems, ambientTime);
      drawEquationSelectionHighlights(
        ctx,
        queries.mathProblems,
        equationMode.selectedProblemIds,
        enemyOccupiedCells,
        ambientTime,
      );
      drawFrogAttackTelegraphs(
        ctx,
        queries.frogTongues,
        currentTime,
        reducedMotion,
      );
      drawAnswerConsumptionEffects(
        ctx,
        queries.mathProblems,
        answerTargets,
        margins,
        currentTime,
        reducedMotion,
      );
      drawEnhancedFrogTongues(ctx, queries.frogTongues, currentTime, 'behindFrog');

      for (const entity of sortedEntities) {
        if (entity.components.renderable.layer < GAME_CONFIG.LAYERS.ENTITIES) continue;
        drawRenderableEntity(entity);
      }

      drawEnhancedFrogTongues(ctx, queries.frogTongues, currentTime, 'aboveFrog');
      if (queries.player) {
        drawFrozenPlayerEffect(ctx, queries.player, currentTime);
        drawDamageFeedback(ctx, queries.player, reducedMotion);
      }
      ctx.restore();

      const levelComplete = ecs.tryGetScreenState('levelComplete');
      if (levelComplete) {
        drawLevelCompleteCelebration(
          ctx,
          levelComplete,
          currentTime,
          reducedMotion,
        );
      }
    });
};

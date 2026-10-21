import { renderMargins } from '../boardGeometry';
import { gameplayTimeMs } from '../gameplayClock';
import type { GameSystemRegistrar } from '../Engine';
import { GAME_CONFIG } from '../../config';
import {
  renderableEntityQuery,
  playerQuery,
  mathProblemQuery,
  frogTongueQuery,
  spiderWebQuery,
  enemyQuery,
  timeAdjustmentQuery,
} from '../queries';
import { collectGridCellKeys } from '../lilyPads';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { cleanupRenderSystem, getCtx } from './render/context';
import { createPondRenderer } from './render/grid';
import { pondThemeForPromptKind } from '../pondTheme';
import { drawEntity } from './render/entities';
import {
  drawAnswerConsumptionEffects,
  drawEquationSelectionHighlights,
  drawSelectionDisruptionEffects,
  drawPlayerHighlight,
  drawMathProblemLilyPads,
  drawMathProblemNumbers,
  drawTapTargetFeedback,
  drawTimeAdjustmentFlights,
} from './render/mathProblems';
import { drawEnhancedSpiderWebs } from './render/spiderWebs';
import { drawEnhancedFrogTongues, drawFrogAttackTelegraphs } from './render/frogTongues';
import { drawFrozenPlayerEffect } from './render/frozenPlayer';
import { drawBoardObjective, drawBoardTime } from './render/objective';
import { getCachedImage } from './render/images';
import { IMAGE_ASSET_KEYS } from '../assets';
import { drawLevelCompleteCelebration } from './render/levelComplete';
import {
  drawEnemySpawnTelegraphs,
  enemyEmergencePresentation,
} from './render/enemyTelegraphs';
import { drawDamageFeedback } from './render/damageFeedback';
import { drawEnemyEliminationBursts, drawEnemySplashes } from './render/enemyElimination';
import { drawSplashCelebration } from './render/splashCelebration';
import { drawEquationChange } from './render/equationChange';

export { initializeRenderSystem } from './render/context';

const reducedMotionPreference = typeof window === 'undefined'
  ? undefined
  : window.matchMedia('(prefers-reduced-motion: reduce)');

export const addRenderSystemToEngine = (
  systems: GameSystemRegistrar,
): void => {
  const pondRenderers = new Map<string, ReturnType<typeof createPondRenderer>>();

  systems.addSystem('renderSystem')
    .setPriority(SYSTEM_PRIORITIES.RENDER)
    .inScreens(['playing', 'tutorial', 'levelComplete'])
    .requiresAssets(IMAGE_ASSET_KEYS)
    .addQuery('renderableEntities', {
      ...renderableEntityQuery,
      optional: ['shake', 'player', 'enemyElimination', 'timers'],
    } as const)
    .addSingleton('player', { ...playerQuery, optional: ['shake'] } as const)
    .addQuery('mathProblems', mathProblemQuery)
    .addQuery('timeAdjustments', timeAdjustmentQuery)
    .addQuery('disruptions', { with: ['position', 'selectionDisruption'], mutates: [] } as const)
    .addQuery('enemies', enemyQuery)
    .addQuery('eliminations', { with: ['enemyElimination'], mutates: [] } as const)
    .addQuery('celebrations', { with: ['eliminationCelebration'], mutates: [] } as const)
    .addQuery('frogTongues', frogTongueQuery)
    .addQuery('spiderWebs', spiderWebQuery)
    .withResources(['equationMode', 'tapFeedback', 'remainingTimeSeconds', 'gameplayClock', 'board'])
    .setOnDetach(cleanupRenderSystem)
    .setProcess(({ queries, ecs, resources: { equationMode, tapFeedback, remainingTimeSeconds, gameplayClock, board } }) => {
      const ctx = getCtx();
      if (!ctx) return;

      const currentTime = gameplayTimeMs(gameplayClock);
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
        reducedMotion,
      );
      const timeTarget = drawBoardTime(ctx, remainingTimeSeconds, margins.top);
      ctx.save();
      ctx.translate(margins.left, margins.top);

      const ambientTime = reducedMotion ? 0 : currentTime;
      const playerShake = queries.player?.components.shake;
      const boardShakeScale = reducedMotion ? 0 : 0.28;

      ctx.translate(
        (playerShake?.offsetX ?? 0) * boardShakeScale,
        (playerShake?.offsetY ?? 0) * boardShakeScale,
      );

      const boardKey = `${board.width},${board.height}`;
      const drawGrid = pondRenderers.get(boardKey) ?? createPondRenderer(board);
      pondRenderers.set(boardKey, drawGrid);
      drawGrid(ctx, ambientTime, pondThemeForPromptKind(equationMode.promptKind));

      const sortedEntities = [...queries.renderableEntities].sort(
        (a, b) => a.components.renderable.layer - b.components.renderable.layer,
      );

      const drawRenderableEntity = (entity: (typeof sortedEntities)[number]): void => {
        const timers = 'timers' in entity.components ? entity.components.timers : undefined;
        const playerComp = 'player' in entity.components ? entity.components.player : undefined;
        const enemyElimination = 'enemyElimination' in entity.components
          ? entity.components.enemyElimination
          : undefined;
        const renderable = entity.components.renderable;
        const shake = entity.components.shake;
        const image = renderable.imageSrc
          ? getCachedImage(ecs, renderable.imageSrc)
          : undefined;
        const emergence = enemyEmergencePresentation(timers?.enemySpawnTelegraph);

        drawEntity(ctx, {
          position: reducedMotion && enemyElimination?.impact
            ? { x: enemyElimination.impact.x, y: enemyElimination.impact.y, rotation: enemyElimination.impact.rotation }
            : entity.components.position,
          renderable,
          image,
          isInvulnerable: timers?.invulnerability?.active === true,
          deathScale: reducedMotion && enemyElimination ? 1 : playerComp?.deathScale ?? enemyElimination?.deathScale ?? 1.0,
          shakeOffsetX: shake?.offsetX ?? 0,
          shakeOffsetY: shake?.offsetY ?? 0,
          opacity: emergence.opacity * (reducedMotion && enemyElimination ? enemyElimination.deathScale : 1),
          visualScale: emergence.scale,
        });
      };

      for (const entity of sortedEntities) {
        if ('mathProblem' in entity.components) continue;
        if (entity.components.renderable.layer >= GAME_CONFIG.LAYERS.ENTITIES) continue;
        drawRenderableEntity(entity);
      }

      drawMathProblemLilyPads(ctx, queries.mathProblems, currentTime, equationMode, reducedMotion);
      drawEnemySpawnTelegraphs(ctx, queries.enemies, currentTime, reducedMotion);
      drawPlayerHighlight(ctx, queries.player, queries.mathProblems, enemyOccupiedCells, ambientTime);
      drawEnhancedSpiderWebs(ctx, queries.spiderWebs, currentTime, reducedMotion);
      drawMathProblemNumbers(ctx, queries.mathProblems, currentTime, equationMode, reducedMotion);
      drawEquationSelectionHighlights(
        ctx,
        queries.mathProblems,
        equationMode.selectedProblemIds,
        enemyOccupiedCells,
        currentTime,
        equationMode,
        reducedMotion,
      );
      drawTapTargetFeedback(ctx, tapFeedback, queries.player, currentTime, reducedMotion);
      drawFrogAttackTelegraphs(
        ctx,
        queries.frogTongues,
        currentTime,
        reducedMotion,
        board,
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

      drawEnemyEliminationBursts(ctx, queries.eliminations, reducedMotion);
      drawEnemySplashes(ctx, queries.eliminations, reducedMotion);
      drawEnhancedFrogTongues(ctx, queries.frogTongues, currentTime, 'aboveFrog');
      drawSelectionDisruptionEffects(ctx, queries.disruptions, currentTime, reducedMotion);
      if (queries.player) {
        drawFrozenPlayerEffect(ctx, queries.player, currentTime);
        drawDamageFeedback(ctx, queries.player, reducedMotion, board);
      }
      ctx.restore();

      drawTimeAdjustmentFlights(
        ctx,
        queries.timeAdjustments,
        timeTarget,
        margins,
        currentTime,
        reducedMotion,
      );
      drawEquationChange(ctx, equationMode, margins, currentTime, reducedMotion);

      if (ecs.getCurrentScreen() === 'playing') {
        for (const entity of queries.celebrations) {
          drawSplashCelebration(ctx, entity.components.eliminationCelebration, reducedMotion);
        }
      }

      const levelComplete = ecs.tryGetScreenState('levelComplete');
      if (levelComplete) {
        drawLevelCompleteCelebration(
          ctx,
          levelComplete,
          performance.now(),
          reducedMotion,
        );
      }
    });
};

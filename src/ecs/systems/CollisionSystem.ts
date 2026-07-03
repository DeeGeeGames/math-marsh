import { gameEngine, type GameEngine } from '../Engine';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { activePlayerGridCell, pixelToGrid, positionInGridCell, sameGridPosition } from '../gameUtils';
import { collectGridCellKeys, positionedEntityGridCellKey } from '../lilyPads';
import {
  playerWithHealthQuery,
  mathProblemWithRenderableQuery,
  enemyWithColliderQuery,
  spiderWebWithRenderableQuery,
  frogTongueQuery,
  type PlayerEntityWithHealth,
  type MathProblemEntityWithRenderable,
  type SpiderWebEntityWithRenderable,
  type FrogTongueEntity
} from '../queries';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { ANIMATION_CONFIG, GAME_CONFIG } from '../../config';
import { startShake, startDeathAnimation } from './AnimationSystem';
import {
  chooseEquationCandidate,
  createEquationModeState,
  equationSelectionText,
  evaluateEquationSelection,
} from '../../math/equations';
import type { BaseEquationModeState, EquationFeedbackKind, EquationModeState } from '../types';
import { playSound } from '../../audio/audio';

const triggerGameOver = (ecs: GameEngine, player: PlayerEntityWithHealth, reason: string): void => {
  console.log(reason);
  playSound('gameOver');
  player.components.player.gameOverPending = true;
  startDeathAnimation(ecs, player.id, player.components.position.rotation ?? 0);
  player.components.timers.deathDelay = createTimer(ANIMATION_CONFIG.DEATH.DURATION / 1000, {
    onComplete: () => { void ecs.setScreen('gameOver', {}); },
  });
};

const isInvulnerable = (player: PlayerEntityWithHealth): boolean =>
  player.components.timers.invulnerability?.active === true;

const startInvulnerability = (player: PlayerEntityWithHealth): void => {
  player.components.timers.invulnerability = createTimer(GAME_CONFIG.TIMING.INVULNERABILITY / 1000);
};

const startDamageReaction = (
  ecs: GameEngine,
  player: PlayerEntityWithHealth,
  animation: { readonly INTENSITY: number; readonly DURATION: number },
): void => {
  startShake(ecs, player.id, animation.INTENSITY, animation.DURATION);
  player.components.timers.damageFeedback = createTimer(animation.DURATION / 1000);
};

type PlayerDamageOptions = {
  animation: { readonly INTENSITY: number; readonly DURATION: number };
  healthDamage?: number;
  invulnerability?: boolean;
};

const applyPlayerDamage = (
  ecs: GameEngine,
  player: PlayerEntityWithHealth,
  {
    animation,
    healthDamage = 0,
    invulnerability = false,
  }: PlayerDamageOptions,
): number => {
  player.components.player.lives -= 1;
  if (healthDamage !== 0) {
    player.components.health.current -= healthDamage;
  }

  startDamageReaction(ecs, player, animation);

  if (invulnerability) {
    startInvulnerability(player);
  }

  return player.components.player.lives;
};

const createEquationFeedback = (
  kind: EquationFeedbackKind,
  options: {
    displayText?: string;
    nextMode?: BaseEquationModeState;
  } = {},
): EquationModeState['feedback'] => ({
  kind,
  startedAt: performance.now(),
  ...options,
});

/**
 * Collision Detection System
 * Handles collisions between entities, particularly player-problem and player-web interactions
 */

// Add the collision system to ECSpresso
export function addCollisionSystemToEngine(): void {
  gameEngine.addSystem('collisionSystem')
    .setPriority(SYSTEM_PRIORITIES.COLLISION)
    .addSingleton('player', { ...playerWithHealthQuery, mutates: ['player', 'health', 'timers'] } as const)
    .addQuery('mathProblems', { ...mathProblemWithRenderableQuery, mutates: ['mathProblem', 'renderable'] } as const)
    .addQuery('enemies', enemyWithColliderQuery)
    .addQuery('spiderWebs', spiderWebWithRenderableQuery)
    .addQuery('frogTongues', frogTongueQuery)
    .withResources(['inputState'])
    .setProcess(({ queries, ecs, resources: { inputState } }) => {
      const player = queries.player;
      if (!player) return;

      const invulnerable = isInvulnerable(player);
      const frozen = player.components.timers.freeze?.active === true;

      if (!invulnerable) {
        for (const frog of queries.frogTongues) {
          const tongue = frog.components.frogTongue;
          if (tongue.phase !== 'idle' && tongue.segments.length > 0 && checkPlayerTongueCollision(player, frog)) {
            handlePlayerTongueCollision(ecs, player, frog);
            break;
          }
        }
      }

      if (!frozen) {
        for (const spiderWeb of queries.spiderWebs) {
          if (spiderWeb.components.timers.webBuild?.active) continue;
          if (sameGridPosition(player.components.position, spiderWeb.components.position)) {
            handlePlayerSpiderWebCollision(ecs, player, spiderWeb);
            break;
          }
        }
      }

      const activeProblemCell = activePlayerGridCell(player);
      const enemyOccupiedCells = collectGridCellKeys(queries.enemies);
      const selectableMathProblems = queries.mathProblems
        .filter(problem => !problem.components.mathProblem.consumed)
        .filter(problem => !enemyOccupiedCells.has(positionedEntityGridCellKey(problem)));

      // Check for math problems that can be consumed
      for (const problem of selectableMathProblems) {
        // Math problems follow the intended active tile, not the rendered midpoint.
        if (positionInGridCell(problem.components.position, activeProblemCell)) {
          if (inputState.actions.justActivated('eat')) {
            handleEquationProblemSelection(ecs, player, problem, selectableMathProblems);
          }
        }
      }

      if (!invulnerable) {
        for (const enemy of queries.enemies) {
          if (enemy.components.timers.enemySpawnTelegraph?.active) continue;
          if (sameGridPosition(player.components.position, enemy.components.position)) {
            handlePlayerEnemyCollision(ecs, player);
          }
        }
      }
    });
}

function beginAnswerConsumption(
  ecs: GameEngine,
  problem: MathProblemEntityWithRenderable,
  startedAt: number,
): void {
  problem.components.mathProblem.consumed = true;
  problem.components.renderable.color = 'transparent';
  problem.components.renderable.size = 0;
  ecs.commands.addComponent(problem.id, 'answerConsumption', {
    startedAt,
  });
}

const selectedProblemValues = (
  selectedProblems: readonly MathProblemEntityWithRenderable[],
): number[] =>
  selectedProblems.map(selectedProblem => selectedProblem.components.mathProblem.value);

const findSelectedProblems = (
  selectedProblemIds: readonly number[],
  mathProblems: readonly MathProblemEntityWithRenderable[],
): MathProblemEntityWithRenderable[] =>
  selectedProblemIds.flatMap((id) => {
    const selectedProblem = mathProblems.find(candidate => candidate.id === id);
    return selectedProblem ? [selectedProblem] : [];
  });

const activeEquationOperands = (
  mathProblems: readonly MathProblemEntityWithRenderable[],
): Array<{ id: number; value: number }> =>
  mathProblems
    .filter(candidate => !candidate.components.mathProblem.consumed)
    .map(candidate => ({
      id: candidate.id,
      value: candidate.components.mathProblem.value,
    }));

function handleEquationProblemSelection(
  ecs: GameEngine,
  player: PlayerEntityWithHealth,
  problem: MathProblemEntityWithRenderable,
  mathProblems: MathProblemEntityWithRenderable[],
): void {
  const equationMode = ecs.getResource('equationMode');
  if (equationMode.target === 0) return;
  if (equationMode.feedback?.kind === 'correct') return;

  const selectableProblemIds = new Set(mathProblems.map(candidate => candidate.id));
  const currentSelectedProblemIds = equationMode.selectedProblemIds
    .filter(id => selectableProblemIds.has(id));
  const selectedProblemIds = currentSelectedProblemIds.includes(problem.id)
    ? currentSelectedProblemIds.filter(id => id !== problem.id)
    : [...currentSelectedProblemIds, problem.id].slice(0, equationMode.operandsRequired);

  const pendingMode = {
    ...equationMode,
    selectedProblemIds,
    feedback: undefined,
  };

  if (selectedProblemIds.length < equationMode.operandsRequired) {
    playSound('answerSelect');
    ecs.setResource('equationMode', pendingMode);
    return;
  }

  const selectedProblems = findSelectedProblems(selectedProblemIds, mathProblems);
  const selectedValues = selectedProblemValues(selectedProblems);
  const isCorrect = evaluateEquationSelection(pendingMode, selectedValues);

  if (!isCorrect) {
    playSound('incorrect');
    handleIncorrectEquationSelection(ecs, player, pendingMode);
    return;
  }

  playSound('correct');
  const consumptionStartedAt = performance.now();
  selectedProblems.forEach(selectedProblem => {
    beginAnswerConsumption(ecs, selectedProblem, consumptionStartedAt);
  });

  const gameMode = ecs.getResource('gameMode');
  const mathDifficulty = ecs.getResource('mathDifficulty');

  const nextMode = createEquationModeState(
    pendingMode.level,
    mathDifficulty,
    gameMode,
    pendingMode.clearedThisLevel + selectedProblemIds.length,
  );

  const nextCandidate = chooseEquationCandidate(
    nextMode,
    activeEquationOperands(mathProblems),
  );
  const nextEquationMode = nextCandidate
    ? { ...nextMode, target: nextCandidate.target, promptValues: nextCandidate.operandValues }
    : nextMode;
  const feedback = createEquationFeedback('correct', {
    displayText: equationSelectionText(pendingMode, selectedValues),
    nextMode: nextEquationMode,
  });

  ecs.setResource('equationMode', {
    ...pendingMode,
    feedback,
  });
}

function handleIncorrectEquationSelection(
  ecs: GameEngine,
  player: PlayerEntityWithHealth,
  equationMode: EquationModeState,
): void {
  const livesRemaining = applyPlayerDamage(ecs, player, {
    animation: ANIMATION_CONFIG.SHAKE.WRONG_ANSWER,
  });

  ecs.setResource('equationMode', {
    ...equationMode,
    selectedProblemIds: [],
    feedback: createEquationFeedback('incorrect'),
  });

  if (livesRemaining <= 0) {
    triggerGameOver(ecs, player, 'Game Over!');
  }
}

/**
 * Handle collision between player and enemy
 */
function handlePlayerEnemyCollision(ecs: GameEngine, player: PlayerEntityWithHealth): void {
  if (isInvulnerable(player)) return;

  console.log('Player hit by enemy!');
  playSound('damage');

  const livesRemaining = applyPlayerDamage(ecs, player, {
    animation: ANIMATION_CONFIG.SHAKE.DAMAGE,
    healthDamage: 1,
    invulnerability: true,
  });

  console.log(`Lives remaining: ${livesRemaining}`);

  if (livesRemaining <= 0) {
    triggerGameOver(ecs, player, 'Game Over!');
  }
}

/**
 * Handle collision between player and spider web
 */
function handlePlayerSpiderWebCollision(
  ecs: GameEngine,
  player: PlayerEntityWithHealth,
  spiderWeb: SpiderWebEntityWithRenderable
): void {
  const freezeTime = spiderWeb.components.spiderWeb.freezeTime;
  console.log(`🕸️ Player caught in spider web! Freezing for ${freezeTime}ms`);
  playSound('web');

  player.components.timers.freeze = createTimer(freezeTime / 1000);
  ecs.commands.removeEntity(spiderWeb.id);
}

/**
 * Handle collision between player and frog tongue
 */
function handlePlayerTongueCollision(
  ecs: GameEngine,
  player: PlayerEntityWithHealth,
  frog: FrogTongueEntity
): void {
  const playerComp = player.components.player;
  const tongueComp = frog.components.frogTongue;

  if (tongueComp.phase === 'idle' || tongueComp.segments.length === 0) return;
  if (isInvulnerable(player)) {
    console.log(`🐸 Player hit by frog tongue but is invulnerable`);
    return;
  }
  if (playerComp.lives <= 0) return;

  console.log(`🐸 Player hit by frog tongue! Taking damage.`);
  playSound('damage');

  const livesRemaining = applyPlayerDamage(ecs, player, {
    animation: ANIMATION_CONFIG.SHAKE.DAMAGE,
    invulnerability: true,
  });

  console.log(`💔 Player loses 1 life. Lives remaining: ${livesRemaining}`);

  if (livesRemaining <= 0) {
    triggerGameOver(ecs, player, '💀 Game Over due to frog tongue attack!');
  }
}

/**
 * Check if player is colliding with frog tongue
 */
function checkPlayerTongueCollision(
  player: PlayerEntityWithHealth, 
  frog: FrogTongueEntity
): boolean {
  const tongue = frog.components.frogTongue;
  
  if (tongue.phase === 'idle' || tongue.segments.length === 0) {
    return false;
  }

  const playerGrid = pixelToGrid(player.components.position.x, player.components.position.y);
  const hit = tongue.segments.some(segment =>
    playerGrid.x === segment.x && playerGrid.y === segment.y
  );

  if (hit) {
    console.log(`🐸 Collision detected: Player at (${playerGrid.x}, ${playerGrid.y}) hit tongue segment`);
  }

  return hit;
}

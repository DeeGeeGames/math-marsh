import { collectGridCellKeys, gridCellKey, gridCells } from '../lilyPads';
import { selectableEquationProblems } from '../selectableEquationProblems';
import { levelClearTarget } from '../levelProgression';
import type { GameEngine, GameSystemRegistrar } from '../Engine';
import { createMathProblem } from '../entities';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { GAME_CONFIG } from '../../config';
import { cellCenter, gridToPixel } from '../gameUtils';
import { gameplayTimeMs } from '../gameplayClock';
import {
  chooseEquationCandidate,
  createEquationModeState,
  createRandomEquationCandidate,
  equationProblemValuesForCandidate,
  evaluateEquationSelection,
  type EquationCandidate,
} from '../../math/equations';
import {
  mathProblemWithRenderableQuery,
  playerQuery,
  positionEntityQuery,
  enemyQuery,
  type MathProblemEntityWithRenderable,
  type PlayerEntity,
  type PositionEntity
} from '../queries';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import type { Resources } from '../types';
import { playSound } from '../../audio/audio';
import { equationModeForMathSession } from '../mathMode';

type ProblemResources = Readonly<Pick<
  Resources,
  'gameMode' | 'currentLevel' | 'equationMode' | 'mathDifficulty' | 'mathSession'
>>;

/**
 * Problem Management System
 * Manages the lifecycle of math problems: spawning, tracking, and replacing consumed ones
 */

// Add the problem management system to ECSpresso
export function addProblemManagementSystemToEngine(
  systems: GameSystemRegistrar,
): void {
  systems.addSystem('problemManagementSystem')
    .inGroup('gameplay')
    .setPriority(SYSTEM_PRIORITIES.PROBLEM_MANAGEMENT)
    .addQuery('mathProblems', { ...mathProblemWithRenderableQuery, mutates: ['mathProblem'] } as const)
    .addSingleton('player', { ...playerQuery, mutates: ['timers'] } as const)
    .addQuery('allPositions', positionEntityQuery)
    .addQuery('enemies', enemyQuery)
    .withResources(['gameMode', 'currentLevel', 'equationMode', 'mathDifficulty', 'board', 'enemySpawn', 'gameplayClock'])
    .setProcess(({ queries, ecs, resources }) => {
      const player = queries.player;
      const mathSession = ecs.tryGetResource('mathSession') ?? null;
      const activeProblems = queries.mathProblems.filter(
        problem => !problem.components.mathProblem.consumed
      );

      if (player && !player.components.player.gameOverPending) {
        const shouldSpawnProblems = activeProblems.length === 0
          && !player.components.timers.problemSpawn?.active;
        const populatedEquationMode = shouldSpawnProblems
          ? populateFullGrid(
              ecs,
              queries.allPositions,
              resources.currentLevel,
              resources.equationMode,
              resources.board,
              queries.enemies,
            )
          : resources.equationMode;
        const selectableProblems = selectableEquationProblems(queries.mathProblems, queries.enemies);
        // Capture the cause before a repair can replace any of the pad values.
        const blockedAnswer = !shouldSpawnProblems
          && !hasSelectableSolution(resources.equationMode, selectableProblems)
          ? activeProblems.find(problem => !selectableProblems.some(free => free.id === problem.id)
            && participatesInSolution(resources.equationMode, problem, activeProblems))
          : undefined;
        const nextEquationMode = shouldSpawnProblems
          ? populatedEquationMode
          : equationStateFromBoard(
              selectableProblems,
              { ...resources, mathSession },
              populatedEquationMode,
            );

        if (shouldSpawnProblems) {
          player.components.timers.problemSpawn = createTimer(GAME_CONFIG.TIMING.SHORT_DELAY / 1000);
        }
        if (nextEquationMode !== resources.equationMode) {
          const previous = resources.equationMode;
          const isReplacement = !shouldSpawnProblems
            && previous.level === nextEquationMode.level
            && previous.target !== null
            && nextEquationMode.target !== null;
          if (isReplacement) {
            ecs.setResource('equationMode', {
              ...nextEquationMode,
              changeNotice: {
                startedAt: gameplayTimeMs(resources.gameplayClock),
                origin: cellCenter(blockedAnswer?.components.position ?? player.components.position),
                reason: blockedAnswer ? 'answerBlocked' : 'answerUnavailable',
              },
            });
            playSound('equationChange');
          } else {
            ecs.setResource('equationMode', nextEquationMode);
          }
        }

        checkEquationLevelCompletion(
          ecs,
          player,
          queries.mathProblems,
          resources.currentLevel,
          nextEquationMode,
          resources.board,
          resources.enemySpawn.roster.length,
        );
      }
      cleanupConsumedProblems(ecs, queries.mathProblems, resources.board);
    });
}

/**
 * Populate the entire grid with math problems
 */
function populateFullGrid(
  ecs: GameEngine,
  allPositionEntities: PositionEntity[],
  currentLevel: number,
  equationMode: Resources['equationMode'],
  board: Resources['board'],
  enemies: readonly PositionEntity[],
): Resources['equationMode'] {
  const availablePositions = getAllGridPositionsWithoutMathProblems(allPositionEntities, board);
  const occupiedCells = collectGridCellKeys(enemies);
  const selectablePositions = availablePositions.filter(cell => !occupiedCells.has(gridCellKey(cell)));
  const occupiedPositions = availablePositions.filter(cell => occupiedCells.has(gridCellKey(cell)));
  if (selectablePositions.length < equationMode.operandsRequired) return equationMode;

  const candidate = createRandomEquationCandidate(equationMode);
  const problemValues = equationProblemValuesForCandidate(
    equationMode,
    candidate,
    selectablePositions.length,
  );

  // Put the guaranteed answers on free pads; occupied pads can still display numbers.
  [...selectablePositions, ...occupiedPositions].forEach((gridPos, index) => {
    const value = problemValues[index % problemValues.length];
    if (value === undefined) throw new Error('Board generation is missing a pad value');
    const pixelPos = gridToPixel(gridPos.x, gridPos.y);
    createMathProblem(ecs.commands, pixelPos.x, pixelPos.y, value, 1);
  });

  console.log(`Populated ${availablePositions.length} available pads for level ${currentLevel}`);
  return {
    ...equationMode,
    target: candidate.target,
    promptValues: candidate.operandValues,
    selectedProblemIds: [],
  };
}

/**
 * Get all grid positions that don't already have math problems
 * This allows players and enemies to coexist with math problems on the same tiles
 */
const gridKey = (x: number, y: number): string => `${x},${y}`;

function getAllGridPositionsWithoutMathProblems(allPositionEntities: PositionEntity[], board: Resources['board']): { x: number; y: number }[] {
  const mathProblemPositions = new Set(
    allPositionEntities
      .filter(entity => entity.components.mathProblem)
      .map(({ components: { position } }) =>
        gridKey(
          Math.round(position.x / GAME_CONFIG.GRID.CELL_SIZE),
          Math.round(position.y / GAME_CONFIG.GRID.CELL_SIZE),
        ),
      ),
  );

  return gridCells(board).filter(({ x, y }) => !mathProblemPositions.has(gridKey(x, y)));
}

function activeEquationProblems(mathProblems: MathProblemEntityWithRenderable[]): MathProblemEntityWithRenderable[] {
  return mathProblems.filter(problem => !problem.components.mathProblem.consumed);
}

function equationStateFromBoard(
  mathProblems: MathProblemEntityWithRenderable[],
  {
    gameMode,
    currentLevel,
    mathDifficulty,
    mathSession,
  }: ProblemResources,
  currentState: Resources['equationMode'],
): Resources['equationMode'] {
  const state = currentState.level === currentLevel
    ? currentState
    : mathSession
      ? equationModeForMathSession(mathSession, gameMode, currentLevel, 0, mathDifficulty)
      : createEquationModeState(currentLevel, mathDifficulty, gameMode);

  if (state.feedback?.kind === 'correct') return currentState;
  if (state.target !== null && hasSelectableSolution(state, mathProblems)) return currentState;

  const existingCandidate = chooseEquationCandidate(
    state,
    activeEquationProblems(mathProblems).map(problem => ({
      id: problem.id,
      value: problem.components.mathProblem.value,
    })),
    { enforceOperandRanges: mathSession !== null },
  );

  // Keep the level's cleared pads and progress. If the remaining free numbers
  // cannot form a prompt, replace only the pads needed for one valid answer.
  const freeProblems = activeEquationProblems(mathProblems);
  const candidate = existingCandidate ?? (freeProblems.length >= state.operandsRequired
    ? restorePlayableAnswer(state, freeProblems)
    : undefined);

  if (!candidate && state.target === null) return currentState;

  return {
    ...state,
    target: candidate?.target ?? null,
    promptValues: candidate?.operandValues ?? [],
    selectedProblemIds: [],
    feedback: undefined,
  };
}

const restorePlayableAnswer = function (
  state: Resources['equationMode'],
  freeProblems: readonly MathProblemEntityWithRenderable[],
): EquationCandidate {
  const candidate = createRandomEquationCandidate(state);
  const values = equationProblemValuesForCandidate(state, candidate, state.operandsRequired);
  values.forEach((value, index) => {
    const problem = freeProblems[index];
    if (!problem) throw new Error('Missing free pad for a restored answer');
    problem.components.mathProblem.value = value;
  });
  return candidate;
};

const hasSelectableSolution = function (
  state: Resources['equationMode'],
  problems: readonly MathProblemEntityWithRenderable[],
): boolean {
  if (state.operandsRequired === 1) {
    return problems.some(problem => evaluateEquationSelection(state, [problem.components.mathProblem.value]));
  }
  return problems.some(left => problems.some(right =>
    left.id !== right.id && evaluateEquationSelection(state, [
      left.components.mathProblem.value,
      right.components.mathProblem.value,
    ]),
  ));
};

const participatesInSolution = function (
  state: Resources['equationMode'],
  problem: MathProblemEntityWithRenderable,
  problems: readonly MathProblemEntityWithRenderable[],
): boolean {
  const value = problem.components.mathProblem.value;
  if (state.operandsRequired === 1) return evaluateEquationSelection(state, [value]);
  return problems.some(other => other.id !== problem.id && (
    evaluateEquationSelection(state, [value, other.components.mathProblem.value])
      || evaluateEquationSelection(state, [other.components.mathProblem.value, value])
  ));
};

/**
 * Pushes a level-complete overlay, preserving the completed board while
 * gameplay systems are suspended. The overlay's transition system advances
 * to the next playing screen after the celebration.
 */
function checkEquationLevelCompletion(
  ecs: GameEngine,
  player: PlayerEntity,
  mathProblems: MathProblemEntityWithRenderable[],
  currentLevel: number,
  equationMode: Resources['equationMode'],
  board: Resources['board'],
  enemyCount: number,
): void {
  if (equationMode.feedback?.kind === 'correct') return;

  const activeCount = activeEquationProblems(mathProblems).length;
  const noPromptAvailable = mathProblems.length > 0
    && activeCount > 0
    && equationMode.target === null;
  const clearTarget = levelClearTarget(board, enemyCount, equationMode.operandsRequired);
  const shouldAdvance = equationMode.clearedThisLevel >= clearTarget
    || (mathProblems.length > 0 && activeCount < equationMode.operandsRequired)
    || noPromptAvailable;

  if (!shouldAdvance) return;

  const nextLevel = currentLevel + 1;
  console.log(`Equation level ${currentLevel} completed. Advancing to level ${nextLevel}`);
  playSound('levelComplete');
  delete player.components.timers.problemSpawn;
  void ecs.pushScreen('levelComplete', {
    completedLevel: currentLevel,
    nextLevel,
    startedAt: performance.now(),
  });
}

/**
 * Clean up consumed problems that are no longer visible
 */
function cleanupConsumedProblems(ecs: GameEngine, mathProblems: MathProblemEntityWithRenderable[], board: Resources['board']): void {
  // Retain the current board until level completion has observed its consumed pads.
  if (mathProblems.length <= board.width * board.height) return;

  mathProblems
    .filter(problem =>
      problem.components.mathProblem.consumed &&
      problem.components.renderable.size === 0
    )
    .forEach(problem => {
      ecs.commands.removeEntity(problem.id);
    });
} 

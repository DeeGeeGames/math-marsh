import { collectGridCellKeys, gridCellKey, gridCells } from '../lilyPads';
import { selectableEquationProblems } from '../selectableEquationProblems';
import { levelClearTarget } from '../levelProgression';
import type { GameEngine, GameSystemRegistrar } from '../Engine';
import { createMathProblem } from '../entities';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { GAME_CONFIG } from '../../config';
import { gridToPixel } from '../gameUtils';
import {
  chooseEquationCandidate,
  createEquationModeState,
  createRandomEquationCandidate,
  equationProblemValuesForCandidate,
  evaluateEquationSelection,
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

type ProblemResources = Readonly<Pick<
  Resources,
  'gameMode' | 'currentLevel' | 'equationMode' | 'mathDifficulty'
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
    .addQuery('mathProblems', mathProblemWithRenderableQuery)
    .addSingleton('player', { ...playerQuery, mutates: ['timers'] } as const)
    .addQuery('allPositions', positionEntityQuery)
    .addQuery('enemies', enemyQuery)
    .withResources(['gameMode', 'currentLevel', 'equationMode', 'mathDifficulty', 'board', 'enemySpawn'])
    .setProcess(({ queries, ecs, resources }) => {
      const player = queries.player;
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
        const nextEquationMode = shouldSpawnProblems
          ? populatedEquationMode
          : equationStateFromBoard(
              selectableEquationProblems(queries.mathProblems, queries.enemies),
              resources,
              populatedEquationMode,
            );

        if (shouldSpawnProblems) {
          player.components.timers.problemSpawn = createTimer(GAME_CONFIG.TIMING.SHORT_DELAY / 1000);
        }
        if (nextEquationMode !== resources.equationMode) {
          ecs.setResource('equationMode', nextEquationMode);
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
  }: ProblemResources,
  currentState: Resources['equationMode'],
): Resources['equationMode'] {
  const state = currentState.level === currentLevel
    ? currentState
    : createEquationModeState(currentLevel, mathDifficulty, gameMode);

  if (state.feedback?.kind === 'correct') return currentState;
  if (state.target !== 0 && hasSelectableSolution(state, mathProblems)) return currentState;

  const candidate = chooseEquationCandidate(
    state,
    activeEquationProblems(mathProblems).map(problem => ({
      id: problem.id,
      value: problem.components.mathProblem.value,
    })),
  );

  if (!candidate && state.target === 0) return currentState;

  return {
    ...state,
    target: candidate?.target ?? 0,
    promptValues: candidate?.operandValues ?? [],
    selectedProblemIds: [],
    feedback: undefined,
  };
}

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
    && equationMode.target === 0;
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

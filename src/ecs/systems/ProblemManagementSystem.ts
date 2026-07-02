import { gameEngine, type GameEngine } from '../Engine';
import { createMathProblem } from '../entities';
import { createTimer } from 'ecspresso/plugins/scripting/timers';
import { GAME_CONFIG } from '../../config';
import { gridToPixel } from '../gameUtils';
import {
  chooseEquationCandidate,
  createEquationModeState,
  createRandomEquationCandidate,
  equationProblemValuesForCandidate,
} from '../../math/equations';
import {
  mathProblemWithRenderableQuery,
  playerQuery,
  positionEntityQuery,
  type MathProblemEntityWithRenderable,
  type PlayerEntity,
  type PositionEntity
} from '../queries';
import { PROBLEM_CONFIG, SYSTEM_PRIORITIES } from '../systemConfigs';
import type { Resources } from '../types';
import { playSound } from '../../audio/audio';

interface ProblemPlacement {
  value: number;
  isCorrect?: boolean;
}

/**
 * Problem Management System
 * Manages the lifecycle of math problems: spawning, tracking, and replacing consumed ones
 */

// Add the problem management system to ECSpresso
export function addProblemManagementSystemToEngine(): void {
  gameEngine.addSystem('problemManagementSystem')
    .setPriority(SYSTEM_PRIORITIES.PROBLEM_MANAGEMENT)
    .addQuery('mathProblems', mathProblemWithRenderableQuery)
    .addSingleton('player', { ...playerQuery, mutates: ['timers'] } as const)
    .addQuery('allPositions', positionEntityQuery)
    .setProcess(({ queries, ecs }) => {
      const player = queries.player;
      const activeProblems = queries.mathProblems.filter(
        problem => !problem.components.mathProblem.consumed
      );

      if (player) {
        const gameMode = ecs.getResource('gameMode');
        const currentLevel = ecs.getResource('currentLevel');
        const shouldPopulate = activeProblems.length === 0;

        if (shouldPopulate && !player.components.timers.problemSpawn?.active) {
          populateFullGrid(ecs, queries.allPositions, currentLevel);
          player.components.timers.problemSpawn = createTimer(GAME_CONFIG.TIMING.SHORT_DELAY / 1000);
        }

        updateEquationStateFromBoard(ecs, queries.mathProblems, gameMode, currentLevel);
        checkEquationLevelCompletion(ecs, player, queries.mathProblems, currentLevel);
      }
      cleanupConsumedProblems(ecs, queries.mathProblems);
    });
}

/**
 * Populate the entire grid with math problems
 */
function populateFullGrid(
  ecs: GameEngine,
  allPositionEntities: PositionEntity[],
  currentLevel: number,
): void {
  const allProblems = createBoardProblems(ecs);
  
  // Get ALL grid positions that don't already have math problems
  const availablePositions = getAllGridPositionsWithoutMathProblems(allPositionEntities);
  
  const problemsToPlace = Math.min(allProblems.length, availablePositions.length);

  allProblems.slice(0, problemsToPlace).forEach((problem, i) => {
    const gridPos = availablePositions[i];
    const pixelPos = gridToPixel(gridPos.x, gridPos.y);
    
    createMathProblem(
      ecs.commands,
      pixelPos.x,
      pixelPos.y,
      problem.value,
      problem.isCorrect,
      1
    );
  });
  
  console.log(`Populated grid with ${problemsToPlace} problems for level ${currentLevel} - ALL grid positions filled`);
}

const createBoardProblems = (
  ecs: GameEngine,
): ProblemPlacement[] => {
  const equationMode = ecs.getResource('equationMode');
  const candidate = createRandomEquationCandidate(equationMode);

  ecs.setResource('equationMode', {
    ...equationMode,
    target: candidate.target,
    promptValues: candidate.operandValues,
    selectedProblemIds: [],
  });

  return equationProblemValuesForCandidate(equationMode, candidate, PROBLEM_CONFIG.TOTAL_PROBLEMS)
    .map(value => ({ value }));
};

/**
 * Get all grid positions that don't already have math problems
 * This allows players and enemies to coexist with math problems on the same tiles
 */
const gridKey = (x: number, y: number): string => `${x},${y}`;

const gridPositions = (): Array<{ x: number; y: number }> =>
  Array.from(
    { length: GAME_CONFIG.GRID.WIDTH * GAME_CONFIG.GRID.HEIGHT },
    (_, index) => ({
      x: index % GAME_CONFIG.GRID.WIDTH,
      y: Math.floor(index / GAME_CONFIG.GRID.WIDTH),
    }),
  );

function getAllGridPositionsWithoutMathProblems(allPositionEntities: PositionEntity[]): { x: number; y: number }[] {
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

  return gridPositions().filter(({ x, y }) => !mathProblemPositions.has(gridKey(x, y)));
}

function activeEquationProblems(mathProblems: MathProblemEntityWithRenderable[]): MathProblemEntityWithRenderable[] {
  return mathProblems.filter(problem => !problem.components.mathProblem.consumed);
}

function updateEquationStateFromBoard(
  ecs: GameEngine,
  mathProblems: MathProblemEntityWithRenderable[],
  gameMode: Resources['gameMode'],
  currentLevel: number,
): void {
  const currentState = ecs.getResource('equationMode');
  const mathDifficulty = ecs.getResource('mathDifficulty');
  const state = currentState.level === currentLevel
    ? currentState
    : createEquationModeState(currentLevel, mathDifficulty, gameMode);

  if (state.target !== 0) return;

  const candidate = chooseEquationCandidate(
    state,
    activeEquationProblems(mathProblems).map(problem => ({
      id: problem.id,
      value: problem.components.mathProblem.value,
    })),
  );

  if (!candidate) return;

  ecs.setResource('equationMode', {
    ...state,
    target: candidate.target,
    promptValues: candidate.operandValues,
    selectedProblemIds: [],
  });
}

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
): void {
  const equationMode = ecs.getResource('equationMode');
  if (equationMode.feedback?.kind === 'correct') return;

  const activeCount = activeEquationProblems(mathProblems).length;
  const noPromptAvailable = mathProblems.length > 0
    && activeCount > 0
    && equationMode.target === 0;
  const shouldAdvance = equationMode.clearedThisLevel >= 10
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
function cleanupConsumedProblems(ecs: GameEngine, mathProblems: MathProblemEntityWithRenderable[]): void {
  if (mathProblems.length <= PROBLEM_CONFIG.TOTAL_PROBLEMS) return;

  mathProblems
    .filter(problem =>
      problem.components.mathProblem.consumed &&
      problem.components.renderable.size === 0
    )
    .forEach(problem => {
      ecs.commands.removeEntity(problem.id);
    });
} 

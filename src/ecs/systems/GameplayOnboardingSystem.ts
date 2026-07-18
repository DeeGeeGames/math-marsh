import { definePlugin, type ScreenDefinition, type ScreensConfig } from 'ecspresso';
import { createTweenSequence } from 'ecspresso/plugins/scripting/tween';
import { GAME_CONFIG } from '../../config';
import {
  createGameplayOnboardingSession,
  SCRIPTED_TUTORIAL_STEPS,
  type GameplayOnboardingKind,
  type GameplayOnboardingPlayerSnapshot,
  type GameplayOnboardingSession,
} from '../../onboarding/gameplayOnboarding';
import {
  nextGameplayOnboardingStep,
  previousGameplayOnboardingStep,
  skipGameplayOnboarding,
  updateGameplayOnboardingUI,
  updateGameplayUI,
} from '../../ui/UIManager';
import { gameEngine, type GameEngine } from '../Engine';
import {
  enemyComponents,
  mathProblemComponents,
  playerComponents,
} from '../entities';
import { gridToPixel } from '../gameUtils';
import {
  mathProblemWithRenderableQuery,
  playerQuery,
  playerWithHealthQuery,
} from '../queries';
import { SYSTEM_PRIORITIES } from '../systemConfigs';
import { startShake } from './AnimationSystem';
import { startEnemyGridMovement } from './EnemySpriteSystem';
import { createEquationModeState } from '../../math/equations';
import type { EquationModeState, TutorialScreenConfig } from '../types';

const TARGET_VALUE = 8;
const PLAYER_START = { x: 1, y: 2 } as const;
const PLAYER_MID = { x: 2, y: 2 } as const;
const PLAYER_TARGET = { x: 3, y: 2 } as const;
const PLAYER_SECOND_TARGET = { x: 4, y: 2 } as const;
const ENEMY_START = { x: 5, y: 2 } as const;
const ENEMY_END = { x: 4, y: 2 } as const;
const DEMO_MOVE_DURATION_SECONDS = 0.7;

type TutorialGridPoint = Readonly<{ x: number; y: number }>;
type TutorialRenderable = NonNullable<ReturnType<typeof enemyComponents>['renderable']>;
type TutorialEnemy = {
  id: number;
  components: {
    position: { x: number; y: number };
    renderable: TutorialRenderable;
  };
};

type RequiresTutorialScreen = ScreensConfig<{
  tutorial: ScreenDefinition<TutorialScreenConfig>;
}>;

const TUTORIAL_EQUATION_CONFIG = {
  basics: {
    level: 1,
    promptKind: 'selectResult',
    operandsRequired: 1,
  },
  operands: {
    level: 2,
    promptKind: 'selectOperands',
    operandsRequired: 2,
  },
} as const satisfies Record<
  GameplayOnboardingKind,
  Pick<EquationModeState, 'level' | 'promptKind' | 'operandsRequired'>
>;

const TUTORIAL_GRID_OVERRIDES = {
  basics: { 7: 16, 15: TARGET_VALUE },
  operands: { 2: 13, 4: 14, 7: 16, 15: 3, 16: 5 },
} as const satisfies Record<GameplayOnboardingKind, Readonly<Record<number, number>>>;

function scriptedEquationMode(kind: GameplayOnboardingKind): EquationModeState {
  const config = TUTORIAL_EQUATION_CONFIG[kind];
  return {
    ...createEquationModeState(config.level, 'easy', 'addition'),
    operation: 'add',
    promptKind: config.promptKind,
    operandsRequired: config.operandsRequired,
    target: TARGET_VALUE,
    promptValues: [3, 5],
    selectedProblemIds: [],
    feedback: undefined,
  };
}

function gridValues(kind: GameplayOnboardingKind): number[] {
  const overrides: Readonly<Record<number, number>> = TUTORIAL_GRID_OVERRIDES[kind];
  return Array.from(
    { length: GAME_CONFIG.GRID.WIDTH * GAME_CONFIG.GRID.HEIGHT },
    (_, index) => overrides[index] ?? index + 1,
  );
}

function spawnTutorialBoard(ecs: GameEngine, kind: GameplayOnboardingKind): void {
  gridValues(kind).forEach((value, index) => {
    const grid = {
      x: index % GAME_CONFIG.GRID.WIDTH,
      y: Math.floor(index / GAME_CONFIG.GRID.WIDTH),
    };
    const pixel = gridToPixel(grid.x, grid.y);
    ecs.spawn(mathProblemComponents(pixel.x, pixel.y, value, value === TARGET_VALUE, 1), {
      scope: 'tutorial',
    });
  });
}

function spawnTutorialEnemy(ecs: GameEngine, kind: GameplayOnboardingKind): void {
  if (kind === 'operands') return;
  const pixel = gridToPixel(ENEMY_START.x, ENEMY_START.y);
  const components = enemyComponents(pixel.x, pixel.y, 'lizard', 'chase');
  const renderable = components.renderable;
  if (!renderable) throw new Error('Tutorial enemy is missing its renderable component');
  ecs.spawn({
    ...components,
    renderable: hiddenEnemyRenderable(renderable),
    timers: {},
  }, { scope: 'tutorial' });
}

function hiddenEnemyRenderable(renderable: TutorialRenderable): TutorialRenderable {
  return {
    ...renderable,
    shape: 'circle',
    color: 'transparent',
    size: 0,
    imageSrc: undefined,
    spriteSheet: undefined,
  };
}

function showTutorialEnemy(
  enemy: TutorialEnemy,
): void {
  const pixel = gridToPixel(ENEMY_START.x, ENEMY_START.y);
  const renderable = enemyComponents(pixel.x, pixel.y, 'lizard', 'chase').renderable;
  if (!renderable) throw new Error('Tutorial enemy is missing its visible renderable');
  Object.assign(enemy.components.renderable, renderable);
}

export function setupScriptedTutorialScene(
  ecs: GameEngine,
  { kind, isReplay, returnTo }: TutorialScreenConfig,
): void {
  const existingPlayer = ecs.tryGetSingleton(playerQuery.with);
  const existingHealth = existingPlayer?.components.health;
  const continuesRun = returnTo.kind === 'level';
  const playerSnapshot: GameplayOnboardingPlayerSnapshot | undefined = existingPlayer
    && existingHealth
    && continuesRun
    ? {
        position: { ...existingPlayer.components.position },
        lives: existingPlayer.components.player.lives,
        gameOverPending: existingPlayer.components.player.gameOverPending,
        health: { current: existingHealth.current, max: existingHealth.max },
        pathFollower: {
          ...existingPlayer.components.pathFollower,
          breadcrumbs: existingPlayer.components.pathFollower.breadcrumbs.map(point => ({ ...point })),
        },
      }
    : undefined;
  if (!continuesRun && existingPlayer) ecs.removeEntity(existingPlayer.id);
  if (continuesRun && (!existingPlayer || !existingHealth)) {
    throw new Error('Operand tutorial requires the active player and health from Level 1');
  }

  if (!continuesRun) {
    ecs.setResource('gameMode', 'addition');
    ecs.setResource('mathDifficulty', 'easy');
    ecs.setResource('currentLevel', kind === 'operands' ? 2 : 1);
    ecs.setResource('gameplayTimeSeconds', 0);
  }
  ecs.setResource('equationMode', scriptedEquationMode(kind));
  const session = createGameplayOnboardingSession(kind, isReplay, returnTo, playerSnapshot);
  ecs.setResource('gameplayOnboardingSession', session);

  if (!continuesRun) {
    const playerPixel = gridToPixel(PLAYER_START.x, PLAYER_START.y);
    ecs.spawn(playerComponents(playerPixel.x, playerPixel.y), { scope: 'tutorial' });
  }
  spawnTutorialBoard(ecs, kind);
  spawnTutorialEnemy(ecs, kind);
  updateGameplayUI(
    ecs.getResource('gameplayTimeSeconds'),
    continuesRun
      ? existingPlayer?.components.player.lives ?? GAME_CONFIG.GAMEPLAY.PLAYER_LIVES
      : GAME_CONFIG.GAMEPLAY.PLAYER_LIVES,
    kind === 'operands' ? 'Learn Level 2' : 'Tutorial',
  );
  updateGameplayOnboardingUI(session);
}

function placePlayer(
  player: {
    components: {
      position: { x: number; y: number };
      player: { lives: number; gameOverPending?: boolean };
      health: { current: number; max: number };
      pathFollower: {
        anchorGridX: number;
        anchorGridY: number;
        breadcrumbs: Array<{ x: number; y: number }>;
        speed: number;
      };
    };
  },
  grid: TutorialGridPoint,
  lives: number = GAME_CONFIG.GAMEPLAY.PLAYER_LIVES,
): void {
  const pixel = gridToPixel(grid.x, grid.y);
  player.components.position.x = pixel.x;
  player.components.position.y = pixel.y;
  player.components.player.lives = lives;
  player.components.player.gameOverPending = false;
  player.components.health.current = lives;
  player.components.pathFollower.anchorGridX = grid.x;
  player.components.pathFollower.anchorGridY = grid.y;
  player.components.pathFollower.breadcrumbs = [];
  player.components.pathFollower.speed = 0;
}

function resetTutorialScene(
  ecs: GameEngine,
  player: Parameters<typeof placePlayer>[0] & { id: number },
  mathProblems: Array<{
    id: number;
    components: {
      mathProblem: { value: number; consumed: boolean };
      renderable: { size: number };
    };
  }>,
  enemy: TutorialEnemy | undefined,
  kind: GameplayOnboardingKind,
  lives: number,
): void {
  placePlayer(player, PLAYER_START, lives);
  ecs.setResource('equationMode', scriptedEquationMode(kind));
  mathProblems.forEach(problem => {
    problem.components.mathProblem.consumed = false;
    problem.components.renderable.size = GAME_CONFIG.GRID.CELL_SIZE * GAME_CONFIG.SIZES.MATH_PROBLEM;
    if (ecs.hasComponent(problem.id, 'answerConsumption')) {
      ecs.commands.removeComponent(problem.id, 'answerConsumption');
    }
  });
  if (enemy) {
    const pixel = gridToPixel(ENEMY_START.x, ENEMY_START.y);
    enemy.components.position.x = pixel.x;
    enemy.components.position.y = pixel.y;
    Object.assign(
      enemy.components.renderable,
      hiddenEnemyRenderable(enemy.components.renderable),
    );
  }
  [player, enemy].filter(candidate => candidate !== undefined).forEach(candidate => {
    if (ecs.hasComponent(candidate.id, 'tween')) ecs.commands.removeComponent(candidate.id, 'tween');
    if (ecs.hasComponent(candidate.id, 'spriteAnimation')) ecs.commands.removeComponent(candidate.id, 'spriteAnimation');
    if (ecs.hasComponent(candidate.id, 'shake')) ecs.commands.removeComponent(candidate.id, 'shake');
  });
}

function animatePlayerTo(
  ecs: GameEngine,
  playerId: number,
  from: TutorialGridPoint,
  to: TutorialGridPoint,
  onComplete?: () => void,
): void {
  const pathFollower = ecs.getComponent(playerId, 'pathFollower');
  if (!pathFollower) throw new Error('Tutorial player is missing its path follower');
  const target = gridToPixel(to.x, to.y);
  pathFollower.anchorGridX = from.x;
  pathFollower.anchorGridY = from.y;
  pathFollower.breadcrumbs = [{ x: to.x, y: to.y }];
  pathFollower.speed = 1;
  ecs.commands.addComponent(playerId, 'tween', createTweenSequence([
    {
      targets: [
        { component: 'position', field: 'x', to: target.x },
        { component: 'position', field: 'y', to: target.y },
      ],
      duration: DEMO_MOVE_DURATION_SECONDS,
    },
  ], {
    onComplete: () => {
      ecs.mutateComponent(playerId, 'pathFollower', follower => {
        follower.anchorGridX = to.x;
        follower.anchorGridY = to.y;
        follower.breadcrumbs = [];
        follower.speed = 0;
      });
      onComplete?.();
    },
  }).tween);
}

function showCorrectAnswer(
  ecs: GameEngine,
  targetProblem: { id: number; components: { mathProblem: { consumed: boolean }; renderable: { size: number } } },
): void {
  const startedAt = performance.now();
  targetProblem.components.mathProblem.consumed = true;
  targetProblem.components.renderable.size = 0;
  ecs.commands.addComponent(targetProblem.id, 'answerConsumption', { startedAt });
  ecs.setResource('equationMode', {
    ...scriptedEquationMode('basics'),
    selectedProblemIds: [targetProblem.id],
    feedback: {
      kind: 'correct',
      startedAt,
      displayText: '3 + 5 = 8',
    },
  });
}

function showFirstOperand(
  ecs: GameEngine,
  firstProblem: { id: number; components: { mathProblem: { consumed: boolean }; renderable: { size: number } } },
): void {
  firstProblem.components.mathProblem.consumed = true;
  firstProblem.components.renderable.size = 0;
  ecs.commands.addComponent(firstProblem.id, 'answerConsumption', { startedAt: performance.now() });
  ecs.setResource('equationMode', {
    ...scriptedEquationMode('operands'),
    selectedProblemIds: [firstProblem.id],
  });
}

function showCompletedOperands(
  ecs: GameEngine,
  firstProblem: Parameters<typeof showFirstOperand>[1],
  secondProblem: Parameters<typeof showFirstOperand>[1],
): void {
  const startedAt = performance.now();
  secondProblem.components.mathProblem.consumed = true;
  secondProblem.components.renderable.size = 0;
  ecs.commands.addComponent(secondProblem.id, 'answerConsumption', { startedAt });
  ecs.setResource('equationMode', {
    ...scriptedEquationMode('operands'),
    selectedProblemIds: [firstProblem.id, secondProblem.id],
    feedback: {
      kind: 'correct',
      startedAt,
      displayText: '3 + 5 = 8',
    },
  });
}

function applyOperandTutorialStep(
  ecs: GameEngine,
  session: Extract<GameplayOnboardingSession, { active: true }>,
  player: Parameters<typeof placePlayer>[0] & { id: number },
  mathProblems: Parameters<typeof resetTutorialScene>[2],
): void {
  const firstProblem = mathProblems.find(problem => problem.components.mathProblem.value === 3);
  const secondProblem = mathProblems.find(problem => problem.components.mathProblem.value === 5);
  if (!firstProblem || !secondProblem) throw new Error('Operand tutorial numbers are missing');

  if (session.stepIndex === 1) {
    placePlayer(player, PLAYER_MID);
    ecs.setResource('equationMode', {
      ...scriptedEquationMode('operands'),
      selectedProblemIds: [firstProblem.id],
    });
  }
  if (session.stepIndex === 2) {
    placePlayer(player, PLAYER_MID);
    animatePlayerTo(ecs, player.id, PLAYER_MID, PLAYER_TARGET, () => {
      showFirstOperand(ecs, firstProblem);
    });
  }
  if (session.stepIndex === 3) {
    placePlayer(player, PLAYER_TARGET);
    showFirstOperand(ecs, firstProblem);
  }
  if (session.stepIndex === 4) {
    placePlayer(player, PLAYER_TARGET);
    showFirstOperand(ecs, firstProblem);
    animatePlayerTo(ecs, player.id, PLAYER_TARGET, PLAYER_SECOND_TARGET, () => {
      showCompletedOperands(ecs, firstProblem, secondProblem);
    });
  }
}

function applyTutorialStep(
  ecs: GameEngine,
  session: Extract<GameplayOnboardingSession, { active: true }>,
  player: Parameters<typeof placePlayer>[0] & { id: number },
  mathProblems: Parameters<typeof resetTutorialScene>[2],
  enemy: Parameters<typeof resetTutorialScene>[3],
): void {
  resetTutorialScene(
    ecs,
    player,
    mathProblems,
    enemy,
    session.kind,
    session.playerSnapshot?.lives ?? GAME_CONFIG.GAMEPLAY.PLAYER_LIVES,
  );
  if (session.kind === 'operands') {
    applyOperandTutorialStep(ecs, session, player, mathProblems);
    updateGameplayUI(
      ecs.getResource('gameplayTimeSeconds'),
      player.components.player.lives,
      'Learn Level 2',
    );
    updateGameplayOnboardingUI(session);
    return;
  }
  const targetProblem = mathProblems.find(problem => problem.components.mathProblem.value === TARGET_VALUE);
  if (!targetProblem) throw new Error('Tutorial target number is missing from the board');

  const step = SCRIPTED_TUTORIAL_STEPS[session.stepIndex];
  if (!step) throw new Error(`Unknown tutorial step: ${session.stepIndex}`);

  if (step.id === 'move') {
    animatePlayerTo(ecs, player.id, PLAYER_START, PLAYER_MID);
  }
  if (step.id === 'identifyTarget') {
    placePlayer(player, PLAYER_MID);
    ecs.setResource('equationMode', {
      ...scriptedEquationMode('basics'),
      selectedProblemIds: [targetProblem.id],
    });
  }
  if (step.id === 'eat') {
    placePlayer(player, PLAYER_MID);
    animatePlayerTo(ecs, player.id, PLAYER_MID, PLAYER_TARGET, () => {
      showCorrectAnswer(ecs, targetProblem);
    });
  }
  if (step.id === 'feedback') {
    placePlayer(player, PLAYER_TARGET, GAME_CONFIG.GAMEPLAY.PLAYER_LIVES - 1);
    ecs.setResource('equationMode', {
      ...scriptedEquationMode('basics'),
      feedback: { kind: 'incorrect', startedAt: performance.now() },
    });
    startShake(ecs, player.id, 4, 420);
  }
  if (step.id === 'enemyDanger' && enemy) {
    placePlayer(player, PLAYER_TARGET);
    showTutorialEnemy(enemy);
    const target = gridToPixel(ENEMY_END.x, ENEMY_END.y);
    startEnemyGridMovement(
      ecs,
      enemy.id,
      'lizard',
      ENEMY_START,
      ENEMY_END,
      target.x,
      target.y,
    );
  }

  updateGameplayUI(0, player.components.player.lives, 'Tutorial');
  updateGameplayOnboardingUI(session);
}

export function addGameplayOnboardingSystemToEngine(): void {
  let appliedSession: GameplayOnboardingSession | undefined;

  gameEngine.addSystem('gameplayOnboardingSystem')
    .setPriority(SYSTEM_PRIORITIES.ONBOARDING)
    .addSingleton('player', {
      ...playerWithHealthQuery,
      mutates: ['position', 'player', 'pathFollower', 'health'],
    } as const)
    .addQuery('mathProblems', {
      ...mathProblemWithRenderableQuery,
      mutates: ['mathProblem', 'renderable'],
    } as const)
    .addSingleton('enemy', {
      with: ['position', 'enemy', 'renderable', 'timers'],
      optional: ['enemySprite'],
      mutates: ['position', 'renderable', 'timers'],
    } as const)
    .withResources(['inputState', 'gameplayOnboardingSession'])
    .setProcess(({ queries, ecs, resources: { inputState, gameplayOnboardingSession } }) => {
      if (!gameplayOnboardingSession.active) return;
      const player = queries.player;
      if (!player) return;

      if (appliedSession !== gameplayOnboardingSession) {
        appliedSession = gameplayOnboardingSession;
        applyTutorialStep(
          ecs,
          gameplayOnboardingSession,
          player,
          queries.mathProblems,
          queries.enemy,
        );
      }

      if (inputState.actions.justActivated('back')) {
        previousGameplayOnboardingStep();
        return;
      }
      if (inputState.actions.justActivated('skip')) {
        skipGameplayOnboarding();
        return;
      }
      if (inputState.actions.justActivated('eat')) nextGameplayOnboardingStep();
    });
}

export const gameplayOnboardingPlugin = definePlugin('gameplayOnboarding')
  .requires<RequiresTutorialScreen>()
  .setSystemDefaults({ inScreens: ['tutorial'] })
  .install(() => {
    addGameplayOnboardingSystemToEngine();
  });

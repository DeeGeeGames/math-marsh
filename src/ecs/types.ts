import type { Timer, TimerComponentTypes } from 'ecspresso/plugins/scripting/timers';
import type { TweenComponentTypes } from 'ecspresso/plugins/scripting/tween';
import type { CoroutineComponentTypes } from 'ecspresso/plugins/scripting/coroutine';
import type { AIBehavior, EnemyType } from '../types/shared';

export type GameAction = 'up' | 'down' | 'left' | 'right' | 'eat' | 'pause';

export type TimerSlot =
  | 'webExpiry'
  | 'webBuild'
  | 'enemySpawnTelegraph'
  | 'frogTongueWindup'
  | 'damageFeedback'
  | 'freeze'
  | 'invulnerability'
  | 'deathDelay'
  | 'enemyMove'
  | 'enemySpawn'
  | 'problemSpawn';

export type GameTimer = Timer<TimerSlot>;

export interface Components {
  position: {
    x: number;
    y: number;
    // 0 = up, 90 = right, 180 = down, 270 = left
    rotation?: number;
  };
  shake: {
    intensity: number;
    duration: number;  // seconds
    elapsed: number;   // seconds
    offsetX: number;
    offsetY: number;
  };
  renderable: {
    shape: 'circle' | 'rectangle' | 'image';
    color: string;
    size: number;
    layer: number;
    imageSrc?: string;
    imageWidth?: number;
    imageHeight?: number;
    spriteSheet?: {
      frameCount: number;
      frameIndex: number;
      flipX?: boolean;
    };
  };
  spriteAnimation: {
    elapsed: number;
    duration: number;
    currentStep: number;
    steps: Array<{
      imageSrc: string;
      frameCount: number;
      duration: number;
      flipX?: boolean;
      reverse?: boolean;
      staticFrameIndex?: number;
    }>;
  };
  frogSprite: {
    facing: 'toward' | 'away' | 'left' | 'right';
  };
  enemySprite: {
    facing: 'toward' | 'away' | 'left' | 'right';
  };
  playerSprite: {
    facing: 'toward' | 'away' | 'left' | 'right';
    elapsed: number;
  };
  player: {
    lives: number;
    gameOverPending?: boolean;
    deathScale: number;
  };
  enemy: {
    enemyType: EnemyType;
    behaviorType: AIBehavior;
    aiState?: {
      targetGridX: number;
      targetGridY: number;
      path: Array<{ x: number, y: number }>;
      pathIndex: number;
      lastPathUpdate: number;
    };
    waypoints?: Array<{ x: number, y: number }>;
    currentWaypoint?: number;
    guardPosition?: { x: number, y: number };
  };
  mathProblem: {
    value: number;
    isCorrect?: boolean;
    difficulty: number;
    consumed: boolean;
  };
  answerConsumption: {
    startedAt: number;
  };
  collider: {
    width: number;
    height: number;
    group: string;
  };
  health: {
    current: number;
    max: number;
  };
  spiderWeb: {
    freezeTime: number;
  };
  frogTongue: {
    direction: { x: number; y: number };
    maxRange: number;
    currentLength: number;
    segments: Array<{ x: number; y: number }>;
    phase: 'idle' | 'windingUp' | 'extending' | 'holding' | 'retracting';
  };
  pathFollower: {
    // Grid cell the fly was last snapped to; the implicit "behind" waypoint
    // that the fly returns to when the queue is truncated to empty mid-segment.
    anchorGridX: number;
    anchorGridY: number;
    breadcrumbs: Array<{ x: number; y: number }>;
    speed: number;
  };
}

export type AllComponents = Components
  & TimerComponentTypes<TimerSlot>
  & TweenComponentTypes
  & CoroutineComponentTypes;

// Must be a `type` (not `interface`) so it satisfies ecspresso's
// `Record<string, unknown>` screen-config constraint.
export type PlayingScreenConfig = { level: number; isFreshGame: boolean };
export type LevelCompleteScreenConfig = {
  completedLevel: number;
  nextLevel: number;
  startedAt: number;
};
export type LevelCompleteScreenState = LevelCompleteScreenConfig & {
  transitionStarted: boolean;
};

export type SettingsReturnScreen = 'menu' | 'modeSelect' | 'playing' | 'paused' | 'gameOver';
export type SettingsScreenConfig = { returnTo: SettingsReturnScreen };

export type GameMode = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'anything';
export type MathDifficulty = 'easy' | 'medium' | 'expert';
export type EquationOperation = 'add' | 'subtract' | 'multiply' | 'divide';
export type EquationPromptKind = 'selectOperands' | 'selectResult';

export interface EquationValueRange {
  min: number;
  max: number;
}

export interface EquationOperandRanges {
  left: EquationValueRange;
  right: EquationValueRange;
}

export type EquationFeedbackKind = 'correct' | 'incorrect';

export interface EquationFeedback {
  kind: EquationFeedbackKind;
  startedAt: number;
  displayText?: string;
  nextMode?: BaseEquationModeState;
}

export interface BaseEquationModeState {
  operation: EquationOperation;
  promptKind: EquationPromptKind;
  difficulty: MathDifficulty;
  operandsRequired: number;
  target: number;
  promptValues: number[];
  selectedProblemIds: number[];
  clearedThisLevel: number;
  level: number;
  operandRanges: EquationOperandRanges;
}

export interface EquationModeState extends BaseEquationModeState {
  feedback?: EquationFeedback;
}

export interface Resources {
  gameMode: GameMode;
  mathDifficulty: MathDifficulty;
  currentLevel: number;
  gameplayTimeSeconds: number;
  enemySpawn: { index: number };
  equationMode: EquationModeState;
  inputPrompt: import('../ui/inputPrompts').InputPromptState;
}

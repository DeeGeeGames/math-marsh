import { gameplayTimeMs } from './gameplayClock';
import type { GameEngine } from './Engine';
import type { PlayerCollisionEntity, MathProblemEntityWithRenderable } from './queries';
import { ANIMATION_CONFIG } from '../config';
import { startDamageReaction } from './playerFeedback';
import {
  chooseEquationCandidate,
  createEquationModeState,
  equationSelectionText,
  evaluateEquationSelection,
} from '../math/equations';
import type {
  BaseEquationModeState,
  EquationFeedbackKind,
  EquationModeState,
  Resources,
} from './types';
import { playSound } from '../audio/audio';
import { GAME_CONFIG } from '../config';

type EquationSelectionResources = Readonly<Pick<
  Resources,
  'equationMode' | 'gameMode' | 'mathDifficulty'
>>;

const createEquationFeedback = (
  startedAt: number,
  kind: EquationFeedbackKind,
  options: {
    displayText?: string;
    nextMode?: BaseEquationModeState;
  } = {},
): EquationModeState['feedback'] => ({
  kind,
  startedAt,
  ...options,
});

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

function beginTimeAdjustment(
  ecs: GameEngine,
  problem: MathProblemEntityWithRenderable,
  startedAt: number,
  seconds: number,
): void {
  ecs.commands.spawn({
    timeAdjustment: {
      startedAt,
      seconds,
      source: {
        x: problem.components.position.x,
        y: problem.components.position.y,
      },
    },
  });
}

export function handleEquationProblemSelection(
  ecs: GameEngine,
  player: PlayerCollisionEntity,
  problem: MathProblemEntityWithRenderable,
  mathProblems: MathProblemEntityWithRenderable[],
  resources: EquationSelectionResources,
): void {
  const { equationMode, gameMode, mathDifficulty } = resources;
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
    handleIncorrectEquationSelection(ecs, player, problem, pendingMode);
    return;
  }

  playSound('correct');
  ecs.setResource('equationsSolved', ecs.getResource('equationsSolved') + 1);
  const consumptionStartedAt = gameplayTimeMs(ecs.getResource('gameplayClock'));
  beginTimeAdjustment(
    ecs,
    problem,
    consumptionStartedAt,
    GAME_CONFIG.GAMEPLAY.CORRECT_ANSWER_BONUS_SECONDS,
  );
  selectedProblems.forEach(selectedProblem => {
    beginAnswerConsumption(ecs, selectedProblem, consumptionStartedAt);
  });

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
  const feedback = createEquationFeedback(consumptionStartedAt, 'correct', {
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
  player: PlayerCollisionEntity,
  problem: MathProblemEntityWithRenderable,
  equationMode: EquationModeState,
): void {
  const startedAt = gameplayTimeMs(ecs.getResource('gameplayClock'));
  beginTimeAdjustment(
    ecs,
    problem,
    startedAt,
    -GAME_CONFIG.GAMEPLAY.WRONG_ANSWER_PENALTY_SECONDS,
  );
  startDamageReaction(ecs, player, ANIMATION_CONFIG.SHAKE.WRONG_ANSWER);

  ecs.setResource('equationMode', {
    ...equationMode,
    selectedProblemIds: [],
    feedback: createEquationFeedback(startedAt, 'incorrect'),
  });
}

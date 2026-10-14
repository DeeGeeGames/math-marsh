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
import { queueTimeAdjustment } from './timeAdjustments';
import { correctAnswerBonusSeconds } from './runTime';
import { startPlayerEatingAnimation } from './systems/PlayerSpriteSystem';
import { recordMathAssessmentAnswer } from './mathAssessment';
import { mathQuestionBudgetSeconds } from './mathSteps';
import { equationModeForMathSession, type MathSession } from './mathMode';

type EquationSelectionResources = Readonly<Pick<
  Resources,
  'equationMode' | 'gameMode' | 'mathDifficulty'
> & Partial<Pick<Resources, 'mathSession'>>>;

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

export function handleEquationProblemSelection(
  ecs: GameEngine,
  player: PlayerCollisionEntity,
  problem: MathProblemEntityWithRenderable,
  mathProblems: MathProblemEntityWithRenderable[],
  resources: EquationSelectionResources,
): void {
  const { equationMode, gameMode, mathDifficulty } = resources;
  if (equationMode.target === null) return;
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
    handleIncorrectEquationSelection(ecs, player, problem, pendingMode, mathDifficulty, resources.mathSession ?? null);
    return;
  }

  playSound('correct');
  startPlayerEatingAnimation(ecs, player.id);
  ecs.setResource('equationsSolved', ecs.getResource('equationsSolved') + 1);
  ecs.setResource('equationsSolvedThisBoard', (ecs.tryGetResource('equationsSolvedThisBoard') ?? 0) + 1);
  const mathSession = addMathAnswer(
    resources.mathSession ?? null,
    equationMode,
    true,
    mathDifficulty,
  );
  if (mathSession) ecs.setResource('mathSession', mathSession);
  const consumptionStartedAt = gameplayTimeMs(ecs.getResource('gameplayClock'));
  queueTimeAdjustment(
    ecs,
    problem.components.position,
    correctAnswerBonusSeconds(mathDifficulty, pendingMode.level),
    consumptionStartedAt,
  );
  selectedProblems.forEach(selectedProblem => {
    beginAnswerConsumption(ecs, selectedProblem, consumptionStartedAt);
  });

  const clearedThisLevel = pendingMode.clearedThisLevel + selectedProblemIds.length;
  const nextMode = mathSession
    ? equationModeForMathSession(mathSession, gameMode, pendingMode.level, clearedThisLevel)
    : createEquationModeState(pendingMode.level, mathDifficulty, gameMode, clearedThisLevel);

  const nextCandidate = chooseEquationCandidate(
    nextMode,
    activeEquationOperands(mathProblems),
    { enforceOperandRanges: mathSession !== null },
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
  mathDifficulty: Resources['mathDifficulty'],
  mathSession: MathSession | null,
): void {
  const updatedMathSession = addMathAnswer(mathSession, equationMode, false, mathDifficulty);
  if (updatedMathSession) ecs.setResource('mathSession', updatedMathSession);
  const startedAt = gameplayTimeMs(ecs.getResource('gameplayClock'));
  queueTimeAdjustment(
    ecs,
    problem.components.position,
    -GAME_CONFIG.GAMEPLAY.WRONG_ANSWER_PENALTY_SECONDS[mathDifficulty],
    startedAt,
  );
  startDamageReaction(ecs, player, ANIMATION_CONFIG.SHAKE.WRONG_ANSWER);

  ecs.setResource('equationMode', {
    ...equationMode,
    selectedProblemIds: [],
    feedback: createEquationFeedback(startedAt, 'incorrect'),
  });
}

const addMathAnswer = function(
	mathSession: MathSession | null,
	equationMode: EquationModeState,
	correct: boolean,
	difficulty: Resources['mathDifficulty'],
): MathSession | null {
	if (!mathSession) return null;
	const track = mathSession.tracks[equationMode.operation];
	const expectedBudget = correct
		? mathQuestionBudgetSeconds(
			track.step,
			equationMode.operation,
			equationMode.promptKind,
			difficulty,
		)
		: undefined;
	const assessment = recordMathAssessmentAnswer(
		track.assessment,
		correct,
		expectedBudget,
	);
	return assessment ? {
		...mathSession,
		tracks: { ...mathSession.tracks, [equationMode.operation]: { ...track, assessment } },
	} : mathSession;
};

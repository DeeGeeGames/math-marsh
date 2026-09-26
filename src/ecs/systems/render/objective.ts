import { equationSelectionText } from '../../../math/equations';
import {
  ANSWER_CONSUMPTION_DURATION_MS,
  CORRECT_ANSWER_HOLD_DURATION_MS,
  EQUATION_FEEDBACK_DURATION_MS,
} from '../../systemConfigs';
import type { MathProblemEntity } from '../../queries';
import type { EquationFeedbackKind, EquationFeedback, EquationModeState } from '../../types';
import { formatRemainingTime } from '../../runTime';

const textColor = '#fff7c6';
const shadowColor = 'rgba(9, 41, 44, 0.9)';
const HEADER_SPLIT_RATIO = 0.72;
const HEADER_SIDE_PADDING = 24;
const HEADER_GAP = 16;

export type EquationValueTarget = {
  x: number;
  y: number;
};

type LocatedEquationValue = {
  id: number;
  start: number;
  end: number;
  target: EquationValueTarget;
};

type SelectedEquationLayout = {
  text: string;
  values: LocatedEquationValue[];
};
const feedbackStyles: Record<EquationFeedbackKind, {
  color: string;
  shadowColor: string;
  glowColor: string;
  shakeStrength: number;
}> = {
  correct: {
    color: '#b7ff88',
    shadowColor: 'rgba(25, 84, 26, 0.95)',
    glowColor: 'rgba(140, 255, 92, 0.32)',
    shakeStrength: 0,
  },
  incorrect: {
    color: '#ff9c8f',
    shadowColor: 'rgba(100, 25, 18, 0.95)',
    glowColor: 'rgba(255, 82, 82, 0.26)',
    shakeStrength: 14,
  },
} as const;

const objectiveTextForMode = (
  equationMode: EquationModeState,
  mathProblems: readonly MathProblemEntity[],
): string => {
  const selectedValues = equationMode.selectedProblemIds.flatMap((id) => {
    const problem = mathProblems.find(candidate => candidate.id === id);
    return problem ? [problem.components.mathProblem.value] : [];
  });

  return equationMode.target === 0
    ? 'Preparing equation'
    : equationSelectionText(equationMode, selectedValues);
};

function objectiveFontSize(margin: number): number {
  return Math.max(20, Math.min(30, margin * 0.42));
}

function objectiveGeometry(
  ctx: CanvasRenderingContext2D,
  text: string,
): { leftX: number; fitScale: number } {
  const rightEdge = ctx.canvas.width * HEADER_SPLIT_RATIO - HEADER_GAP;
  const availableWidth = rightEdge - HEADER_SIDE_PADDING;
  return {
    leftX: HEADER_SIDE_PADDING,
    fitScale: Math.min(1, availableWidth / Math.max(1, ctx.measureText(text).width * 1.13)),
  };
}

function selectedEquationLayout(
  ctx: CanvasRenderingContext2D,
  equationMode: EquationModeState,
  mathProblems: readonly MathProblemEntity[],
  margin: number,
): SelectedEquationLayout {
  const selectedProblems = equationMode.selectedProblemIds.flatMap(id => {
    const problem = mathProblems.find(candidate => candidate.id === id);
    return problem ? [problem] : [];
  });
  const selectedValues = selectedProblems.map(problem => problem.components.mathProblem.value);
  const text = equationSelectionText(equationMode, selectedValues);
  const resultSearchStart = text.lastIndexOf('=') + 1;

  ctx.save();
  ctx.font = `bold ${objectiveFontSize(margin)}px Arial`;
  const { leftX, fitScale } = objectiveGeometry(ctx, text);
  const initialCursor = equationMode.promptKind === 'selectResult' ? resultSearchStart : 0;
  const located = selectedProblems.reduce<{
    cursor: number;
    values: LocatedEquationValue[];
  }>((state, problem) => {
    const valueText = problem.components.mathProblem.value.toString();
    const valueStart = text.indexOf(valueText, state.cursor);
    if (valueStart < 0) return state;

    const valueEnd = valueStart + valueText.length;
    const x = leftX + (
      ctx.measureText(text.slice(0, valueStart)).width
      + ctx.measureText(valueText).width / 2
    ) * fitScale;
    return {
      cursor: valueEnd,
      values: [
        ...state.values,
        {
          id: problem.id,
          start: valueStart,
          end: valueEnd,
          target: { x, y: margin * 0.48 },
        },
      ],
    };
  }, { cursor: initialCursor, values: [] });
  ctx.restore();

  return { text, values: located.values };
}

const activeFeedback = (
  feedback: EquationFeedback | undefined,
  currentTime: number,
): { feedback: EquationFeedback; elapsed: number; progress: number } | undefined => {
  if (!feedback) return undefined;

  const elapsed = currentTime - feedback.startedAt;
  const feedbackDurationMs = EQUATION_FEEDBACK_DURATION_MS[feedback.kind];
  if (elapsed >= feedbackDurationMs) return undefined;

  return {
    feedback,
    elapsed,
    progress: Math.max(0, elapsed / feedbackDurationMs),
  };
};

function drawOutlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
): void {
  ctx.strokeText(text, x, 0);
  ctx.fillText(text, x, 0);
}

function drawEquationAwaitingValues(
  ctx: CanvasRenderingContext2D,
  layout: SelectedEquationLayout,
): void {
  const textLeft = 0;
  const segments = layout.values.reduce<{
    cursor: number;
    items: Array<{ text: string; x: number }>;
  }>((state, value) => ({
    cursor: value.end,
    items: [
      ...state.items,
      {
        text: layout.text.slice(state.cursor, value.start),
        x: textLeft + ctx.measureText(layout.text.slice(0, state.cursor)).width,
      },
      {
        text: '_',
        x: textLeft
          + ctx.measureText(layout.text.slice(0, value.start)).width
          + ctx.measureText(layout.text.slice(value.start, value.end)).width / 2
          - ctx.measureText('_').width / 2,
      },
    ],
  }), { cursor: 0, items: [] });
  const trailingText = layout.text.slice(segments.cursor);
  const trailingX = textLeft + ctx.measureText(layout.text.slice(0, segments.cursor)).width;

  ctx.textAlign = 'left';
  [...segments.items, { text: trailingText, x: trailingX }]
    .filter(item => item.text.length > 0)
    .forEach(item => drawOutlinedText(ctx, item.text, item.x));
}

export const drawBoardObjective = (
  ctx: CanvasRenderingContext2D,
  equationMode: EquationModeState,
  mathProblems: readonly MathProblemEntity[],
  margin: number,
  currentTime: number,
): ReadonlyMap<number, EquationValueTarget> => {
  const feedbackState = activeFeedback(equationMode.feedback, currentTime);
  const awaitingAnimatedValues = feedbackState?.feedback.kind === 'correct'
    && feedbackState.elapsed < ANSWER_CONSUMPTION_DURATION_MS;
  const selectedLayout = awaitingAnimatedValues
    ? selectedEquationLayout(ctx, equationMode, mathProblems, margin)
    : undefined;
  const answerTargets = new Map(
    selectedLayout?.values.map(value => [value.id, value.target] as const) ?? [],
  );
  const text = feedbackState?.feedback.displayText ?? objectiveTextForMode(equationMode, mathProblems);
  const normalizedText = text.trim();
  if (normalizedText.length === 0) return answerTargets;

  const fontSize = objectiveFontSize(margin);
  const progress = feedbackState?.progress ?? 1;
  const feedbackStyle = feedbackState ? feedbackStyles[feedbackState.feedback.kind] : undefined;
  const fade = 1 - progress;
  const holdProgress = feedbackState?.feedback.kind === 'correct'
    ? Math.max(0, (feedbackState.elapsed - ANSWER_CONSUMPTION_DURATION_MS) / CORRECT_ANSWER_HOLD_DURATION_MS)
    : progress;
  const pulse = Math.sin(holdProgress * Math.PI);
  const xOffset = feedbackStyle ? Math.sin(progress * Math.PI * 12) * feedbackStyle.shakeStrength * fade : 0;
  const scale = feedbackStyle ? 1 + pulse * 0.13 : 1;
  const y = margin * 0.48;

  ctx.save();
  ctx.font = `bold ${fontSize}px Arial`;
  const { leftX, fitScale } = objectiveGeometry(ctx, normalizedText);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  ctx.translate(leftX + xOffset, y);
  ctx.scale(scale * fitScale, scale * fitScale);

  if (feedbackStyle) {
    ctx.shadowColor = feedbackStyle.glowColor;
    ctx.shadowBlur = 32 * fade;
  }

  ctx.strokeStyle = feedbackStyle?.shadowColor ?? shadowColor;
  ctx.fillStyle = feedbackStyle?.color ?? textColor;
  if (awaitingAnimatedValues && selectedLayout) {
    drawEquationAwaitingValues(ctx, selectedLayout);
  } else {
    drawOutlinedText(ctx, normalizedText, 0);
  }
  ctx.restore();
  return answerTargets;
};

export const drawBoardTime = (
  ctx: CanvasRenderingContext2D,
  remainingSeconds: number,
  margin: number,
): EquationValueTarget => {
  const text = `Time ${formatRemainingTime(remainingSeconds)}`;
  const availableWidth = ctx.canvas.width * (1 - HEADER_SPLIT_RATIO) - HEADER_SIDE_PADDING - HEADER_GAP;

  ctx.save();
  ctx.font = `bold ${objectiveFontSize(margin)}px Arial`;
  const timeWidth = ctx.measureText(formatRemainingTime(remainingSeconds)).width;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  const fitScale = Math.min(1, availableWidth / Math.max(1, ctx.measureText(text).width));
  const target = {
    x: ctx.canvas.width - HEADER_SIDE_PADDING - timeWidth * fitScale * 0.5,
    y: margin * 0.48,
  };
  ctx.translate(ctx.canvas.width - HEADER_SIDE_PADDING, margin * 0.48);
  ctx.scale(fitScale, fitScale);
  ctx.strokeStyle = shadowColor;
  ctx.fillStyle = remainingSeconds <= 15 ? feedbackStyles.incorrect.color : textColor;
  drawOutlinedText(ctx, text, 0);
  ctx.restore();
  return target;
};

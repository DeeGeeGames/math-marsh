import { GAME_CONFIG } from '../../../config';
import {
  cellCenter,
  gridCellCenter,
  pixelToGrid,
  timerElapsedProgress,
} from '../../gameUtils';
import type { FrogTongueEntity } from '../../queries';

type Tongue = FrogTongueEntity['components']['frogTongue'];
type ActivePhase = Exclude<Tongue['phase'], 'idle' | 'windingUp'>;
type TongueLayer = 'behindFrog' | 'aboveFrog';
type DirectionKey = 'away' | 'toward' | 'left' | 'right';
type TonguePresentation = {
  anchor: { x: number; y: number };
  layer: TongueLayer;
  flattenToAnchorY: boolean;
};

interface TongueStyle {
  baseOpacity: number;
  lineWidth: number;
  tongueRGB: string;
}

const DEFAULT_RGB = '255, 20, 147';
const CELL = GAME_CONFIG.GRID.CELL_SIZE;
const AWAY_MOUTH_ANCHOR = { x: 0, y: -0.22 } as const;
const TOWARD_MOUTH_ANCHOR = { x: 0, y: -0.10 } as const;
const SIDE_MOUTH_ANCHOR = { x: 0.14, y: -0.14 } as const;
const WARNING_COLOR = '255, 238, 120';

const TONGUE_PRESENTATION: Record<DirectionKey, TonguePresentation> = {
  away: {
    anchor: AWAY_MOUTH_ANCHOR,
    layer: 'behindFrog',
    flattenToAnchorY: false,
  },
  toward: {
    anchor: TOWARD_MOUTH_ANCHOR,
    layer: 'aboveFrog',
    flattenToAnchorY: false,
  },
  left: {
    anchor: { x: -SIDE_MOUTH_ANCHOR.x, y: SIDE_MOUTH_ANCHOR.y },
    layer: 'aboveFrog',
    flattenToAnchorY: true,
  },
  right: {
    anchor: SIDE_MOUTH_ANCHOR,
    layer: 'aboveFrog',
    flattenToAnchorY: true,
  },
} as const;

const TONGUE_PHASE_STYLES: Record<ActivePhase, (currentTime: number, tongue: Tongue) => TongueStyle> = {
  extending: (currentTime) => {
    const pulse = 0.8 + 0.2 * Math.sin(currentTime * 0.01);
    return { baseOpacity: pulse, lineWidth: 8 * pulse, tongueRGB: DEFAULT_RGB };
  },
  holding: () => ({ baseOpacity: 1.0, lineWidth: 10, tongueRGB: '255, 50, 150' }),
  retracting: (_, tongue) => {
    const fade = Math.max(0.3, tongue.currentLength / (tongue.maxRange * GAME_CONFIG.GRID.CELL_SIZE));
    return { baseOpacity: fade, lineWidth: 8, tongueRGB: DEFAULT_RGB };
  },
};

function directionKey({ x, y }: Tongue['direction']): DirectionKey {
  if (Math.abs(x) >= Math.abs(y)) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'away' : 'toward';
}

function tonguePresentation(tongue: Tongue): TonguePresentation {
  return TONGUE_PRESENTATION[directionKey(tongue.direction)];
}

function mouthAnchor(
  position: FrogTongueEntity['components']['position'],
  anchor: TonguePresentation['anchor'],
): { x: number; y: number } {
  const center = cellCenter(position);
  return {
    x: center.x + anchor.x * CELL,
    y: center.y + anchor.y * CELL,
  };
}

function visibleTonguePoints(
  tongue: Tongue,
  mouthY: number,
  flattenToAnchorY: boolean,
): Array<{ x: number; y: number }> {
  const gridPoints = tongue.segments.map(s => gridCellCenter(s.x, s.y));
  if (!flattenToAnchorY) return gridPoints;
  return gridPoints.map(({ x }) => ({ x, y: mouthY }));
}

const drawTongueTip = (
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  baseOpacity: number,
): void => {
  const glowRadius = 12;
  const gradient = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, glowRadius);
  gradient.addColorStop(0, `rgba(${DEFAULT_RGB}, ${baseOpacity * 0.8})`);
  gradient.addColorStop(0.5, `rgba(${DEFAULT_RGB}, ${baseOpacity * 0.3})`);
  gradient.addColorStop(1, `rgba(${DEFAULT_RGB}, 0)`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(tipX, tipY, glowRadius, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = `rgba(${DEFAULT_RGB}, ${baseOpacity})`;
  ctx.beginPath();
  ctx.arc(tipX, tipY, 6, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = `rgba(255, 150, 200, ${baseOpacity * 0.8})`;
  ctx.beginPath();
  ctx.arc(tipX - 2, tipY - 2, 3, 0, 2 * Math.PI);
  ctx.fill();
};

function telegraphedCells(frog: FrogTongueEntity): Array<{ x: number; y: number }> {
  const start = pixelToGrid(
    frog.components.position.x,
    frog.components.position.y,
  );
  const { direction, maxRange } = frog.components.frogTongue;

  return Array.from({ length: maxRange }, (_, index) => ({
    x: start.x + direction.x * (index + 1),
    y: start.y + direction.y * (index + 1),
  })).filter(({ x, y }) => (
    x >= 0
    && x < GAME_CONFIG.GRID.WIDTH
    && y >= 0
    && y < GAME_CONFIG.GRID.HEIGHT
  ));
}

export function drawFrogAttackTelegraphs(
  ctx: CanvasRenderingContext2D,
  frogs: FrogTongueEntity[],
  currentTime: number,
  reducedMotion: boolean,
): void {
  frogs.forEach(frog => {
    const tongue = frog.components.frogTongue;
    if (tongue.phase !== 'windingUp') return;

    const progress = timerElapsedProgress(
      frog.components.timers.frogTongueWindup,
    );
    const pulse = reducedMotion ? 0.7 : 0.55 + Math.sin(progress * Math.PI * 5) * 0.18;
    const presentation = tonguePresentation(tongue);
    const mouth = mouthAnchor(frog.components.position, presentation.anchor);
    const cells = telegraphedCells(frog);
    const target = cells.at(-1);
    if (!target) return;

    const targetCenter = gridCellCenter(target.x, target.y);
    const lineEnd = presentation.flattenToAnchorY
      ? { x: targetCenter.x, y: mouth.y }
      : targetCenter;

    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = reducedMotion ? 0 : -progress * 28;
    ctx.strokeStyle = `rgba(${WARNING_COLOR}, ${pulse})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(mouth.x, mouth.y);
    ctx.lineTo(lineEnd.x, lineEnd.y);
    ctx.stroke();
    ctx.setLineDash([]);

    cells.forEach((cellPosition, index) => {
      const center = gridCellCenter(cellPosition.x, cellPosition.y);
      const cellPulse = reducedMotion
        ? 1
        : 1 + Math.sin(currentTime * 0.018 - index * 0.7) * 0.1;
      ctx.strokeStyle = `rgba(${WARNING_COLOR}, ${0.28 + progress * 0.42})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(
        center.x,
        presentation.flattenToAnchorY ? mouth.y : center.y,
        CELL * 0.27 * cellPulse,
        CELL * 0.11 * cellPulse,
        -0.18,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    });
    ctx.restore();
  });
}

export const drawEnhancedFrogTongues = (
  ctx: CanvasRenderingContext2D,
  frogs: FrogTongueEntity[],
  currentTime: number,
  layer: TongueLayer = 'aboveFrog',
): void => {
  for (const frog of frogs) {
    const tongue = frog.components.frogTongue;
    if (tongue.phase === 'idle' || tongue.phase === 'windingUp' || tongue.segments.length === 0) continue;
    const presentation = tonguePresentation(tongue);
    if (presentation.layer !== layer) continue;

    const { x: mouthX, y: mouthY } = mouthAnchor(frog.components.position, presentation.anchor);
    const { baseOpacity, lineWidth, tongueRGB } = TONGUE_PHASE_STYLES[tongue.phase](currentTime, tongue);
    const segmentCenters = visibleTonguePoints(tongue, mouthY, presentation.flattenToAnchorY);

    ctx.save();

    ctx.strokeStyle = `rgba(120, 10, 80, ${baseOpacity * 0.3})`;
    ctx.lineWidth = lineWidth + 2;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(mouthX + 2, mouthY + 2);
    for (const { x, y } of segmentCenters) ctx.lineTo(x + 2, y + 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(${tongueRGB}, ${baseOpacity})`;
    ctx.lineWidth = lineWidth;

    ctx.beginPath();
    ctx.moveTo(mouthX, mouthY);
    for (const { x, y } of segmentCenters) ctx.lineTo(x, y);
    ctx.stroke();

    const { x: tipX, y: tipY } = segmentCenters[segmentCenters.length - 1];
    drawTongueTip(ctx, tipX, tipY, baseOpacity);

    ctx.restore();
  }
};

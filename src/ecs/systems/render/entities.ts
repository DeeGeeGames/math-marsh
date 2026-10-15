import { GAME_CONFIG } from '../../../config';
import { cellCenter } from '../../gameUtils';
import type { AllComponents } from '../../types';

type Renderable = AllComponents['renderable'];

const MAX_IMAGE_SIZE = GAME_CONFIG.GRID.CELL_SIZE;

function entityBaselineY(
  position: { y: number },
  renderable: Renderable,
  shakeOffsetY: number,
): number | undefined {
  return renderable.layer >= GAME_CONFIG.LAYERS.ENTITIES
    ? position.y + GAME_CONFIG.GRID.CELL_SIZE * GAME_CONFIG.RENDER.ENTITY_BASELINE_RATIO + shakeOffsetY
    : undefined;
}

function centerYFromBaseline(
  centerY: number,
  baselineY: number | undefined,
  height: number,
): number {
  return baselineY === undefined ? centerY : baselineY - height / 2;
}

const calculateImageDimensions = (
  img: { width: number; height: number },
  requestedWidth?: number,
  requestedHeight?: number,
): { width: number; height: number } => {
  const aspectRatio = img.width / img.height;
  const width0 = requestedWidth ?? MAX_IMAGE_SIZE;
  const height0 = requestedHeight ?? MAX_IMAGE_SIZE;
  const maxImageSize = Math.max(MAX_IMAGE_SIZE, width0, height0);

  if (aspectRatio > 1) {
    const heightFromWidth = width0 / aspectRatio;
    if (heightFromWidth > maxImageSize) {
      return { width: maxImageSize * aspectRatio, height: maxImageSize };
    }
    return { width: width0, height: heightFromWidth };
  }

  const widthFromHeight = height0 * aspectRatio;
  if (widthFromHeight > maxImageSize) {
    return { width: maxImageSize, height: maxImageSize / aspectRatio };
  }
  return { width: widthFromHeight, height: height0 };
};

interface ShapeArgs {
  ctx: CanvasRenderingContext2D;
  centerX: number;
  centerY: number;
  rotation: number;
  renderable: Renderable;
  deathScale: number;
  image?: HTMLImageElement | undefined;
  baselineY?: number | undefined;
}

const drawImageShape = ({
  ctx,
  centerX,
  centerY,
  rotation,
  renderable,
  deathScale,
  image,
  baselineY,
}: ShapeArgs): void => {
  if (!image || !image.complete) {
    const radius = (renderable.size / 2) * deathScale;
    ctx.fillStyle = renderable.color;
    ctx.beginPath();
    ctx.arc(centerX, centerYFromBaseline(centerY, baselineY, radius * 2), radius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const spriteSheet = renderable.spriteSheet;
  const sourceWidth = spriteSheet ? image.width / spriteSheet.frameCount : image.width;
  const sourceHeight = image.height;
  const dimensionImage = spriteSheet
    ? { width: sourceWidth, height: sourceHeight }
    : image;

  const { width, height } = calculateImageDimensions(
    dimensionImage,
    renderable.imageWidth,
    renderable.imageHeight,
  );
  const scaledWidth = width * deathScale;
  const scaledHeight = height * deathScale;
  const drawCenterY = centerYFromBaseline(centerY, baselineY, scaledHeight);
  const drawImage = (): void => {
    if (!spriteSheet) {
      ctx.drawImage(image, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      return;
    }

    const frameIndex = Math.max(0, Math.min(spriteSheet.frameCount - 1, spriteSheet.frameIndex));
    ctx.drawImage(
      image,
      frameIndex * sourceWidth,
      0,
      sourceWidth,
      sourceHeight,
      -scaledWidth / 2,
      -scaledHeight / 2,
      scaledWidth,
      scaledHeight,
    );
  };

  ctx.save();
  ctx.translate(centerX, drawCenterY);
  if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
  if (spriteSheet?.flipX) ctx.scale(-1, 1);
  drawImage();
  ctx.restore();
};

const drawCircleShape = ({ ctx, centerX, centerY, renderable, deathScale, baselineY }: ShapeArgs): void => {
  const radius = (renderable.size / 2) * deathScale;
  ctx.fillStyle = renderable.color;
  ctx.beginPath();
  ctx.arc(centerX, centerYFromBaseline(centerY, baselineY, radius * 2), radius, 0, Math.PI * 2);
  ctx.fill();
};

const drawRectangleShape = ({ ctx, centerX, centerY, renderable, deathScale, baselineY }: ShapeArgs): void => {
  ctx.fillStyle = renderable.color;
  const halfSize = (renderable.size / 2) * deathScale;
  ctx.fillRect(
    centerX - halfSize,
    centerYFromBaseline(centerY, baselineY, renderable.size * deathScale) - halfSize,
    renderable.size * deathScale,
    renderable.size * deathScale,
  );
};

const SHAPE_RENDERERS: Record<Renderable['shape'], (args: ShapeArgs) => void> = {
  image: drawImageShape,
  circle: drawCircleShape,
  rectangle: drawRectangleShape,
};

export interface DrawEntityArgs {
  position: { x: number; y: number; rotation?: number };
  renderable: Renderable;
  image?: HTMLImageElement | undefined;
  isInvulnerable: boolean;
  deathScale: number;
  shakeOffsetX: number;
  shakeOffsetY: number;
  opacity?: number;
  visualScale?: number;
}

export const drawEntity = (ctx: CanvasRenderingContext2D, args: DrawEntityArgs): void => {
  const {
    position,
    renderable,
    image,
    isInvulnerable,
    deathScale,
    shakeOffsetX,
    shakeOffsetY,
    opacity = 1,
    visualScale = 1,
  } = args;
  const center = cellCenter(position);
  const baselineY = entityBaselineY(position, renderable, shakeOffsetY);

  ctx.save();
  ctx.globalAlpha = opacity * (isInvulnerable ? 0.5 : 1);

  SHAPE_RENDERERS[renderable.shape]({
    ctx,
    centerX: center.x + shakeOffsetX,
    centerY: center.y + shakeOffsetY,
    rotation: position.rotation ?? 0,
    renderable,
    deathScale: deathScale * visualScale,
    image,
    baselineY,
  });

  ctx.restore();
};

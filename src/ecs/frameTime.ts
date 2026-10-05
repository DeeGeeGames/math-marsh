const MAX_FRAME_SECONDS = 0.1;

/** Discard suspension/stall time instead of catching the simulation up in one step. */
export const frameDeltaSeconds = function(
  currentTime: number,
  previousTime: number,
  hidden: boolean,
): number {
  if (hidden) return 0;
  const elapsedSeconds = (currentTime - previousTime) / 1000;
  if (!Number.isFinite(elapsedSeconds)) return 0;
  return Math.min(MAX_FRAME_SECONDS, Math.max(0, elapsedSeconds));
};

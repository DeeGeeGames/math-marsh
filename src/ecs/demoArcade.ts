import type { SteamAppRole } from '../platform/desktop';

export const DEMO_ARCADE_ROUNDS = 5;

/** Run-local only: never included in profiles or portable saves. */
export type DemoArcadeRun = Readonly<{ completedLevels: readonly number[] }>;

export const createDemoArcadeRun = function(role: SteamAppRole): DemoArcadeRun | null {
  return role === 'demo' ? { completedLevels: [] } : null;
};

export const isDemoArcadeComplete = function(run: DemoArcadeRun | null | undefined): boolean {
  return (run?.completedLevels.length ?? 0) >= DEMO_ARCADE_ROUNDS;
};

export const completeDemoArcadeRound = function(run: DemoArcadeRun | null, level: number): DemoArcadeRun | null {
  if (!run || isDemoArcadeComplete(run) || !Number.isInteger(level) || level < 1
    || run.completedLevels.includes(level)) return run;
  return { completedLevels: [...run.completedLevels, level] };
};

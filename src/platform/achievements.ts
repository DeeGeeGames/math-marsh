import { savedRosterAchievements } from '../achievements/rules';
import type { PlayerProfilesState } from '../profiles/types';
import { getDesktopSteamRole } from './desktop';

export const submitSavedAchievements = function(state: PlayerProfilesState): void {
  const names = savedRosterAchievements(state, getDesktopSteamRole());
  if (names.length === 0) return;
  // Native delivery failure never changes save success or interrupts gameplay.
  try { void window.mathMarshDesktop?.unlockAchievements?.(names).catch(() => {}); } catch { /* Retry on a later saved roster. */ }
};

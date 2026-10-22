import { emptyPracticeProgress } from '../ecs/practiceProgress';
import { initialSavedMathProgress } from '../ecs/mathProgressStore';
import type { EquationOperation } from '../ecs/types';
import type { PlayerLearnerData, PlayerProfile, PlayerProfilesState, PlayerProfilesResult, PlayerNameError } from './types';

export const MAX_PLAYER_PROFILES = 10;
export const PLAYER_NAME_MAX_LENGTH = 20;
const OPERATIONS: readonly EquationOperation[] = ['add', 'subtract', 'multiply', 'divide'];

const freshOnboarding = function(): PlayerLearnerData['onboarding'] {
  return {
    basics: 'pending',
    operands: 'pending',
    operandAndResult: 'pending',
  };
};

export const initialPlayerLearnerData = function(): PlayerLearnerData {
  return {
    mathProgress: initialSavedMathProgress(),
    onboarding: freshOnboarding(),
    skitProgress: [],
    practiceProgress: emptyPracticeProgress(),
  };
};

export const validatePlayerName = function(
  value: string,
  profiles: readonly PlayerProfile[],
  exceptProfileId?: string,
): Readonly<{ name: string; error?: PlayerNameError }> {
  const name = value.trim();
  if (name.length === 0) return { name, error: 'blank' };
  if (name.length > PLAYER_NAME_MAX_LENGTH) return { name, error: 'tooLong' };
  const duplicate = profiles.some(profile => profile.id !== exceptProfileId
    && profile.name.toLowerCase() === name.toLowerCase());
  return duplicate ? { name, error: 'duplicate' } : { name };
};

export const nextDefaultPlayerName = function(profiles: readonly PlayerProfile[]): string {
  const names = new Set(profiles.map(profile => profile.name.toLowerCase()));
  const candidates = Array.from({ length: MAX_PLAYER_PROFILES + 1 }, (_, index) =>
    index === 0 ? 'Player' : `Player ${index + 1}`);
  return candidates.find(name => !names.has(name.toLowerCase())) ?? `Player ${MAX_PLAYER_PROFILES + 1}`;
};

export const activePlayerProfile = function(state: PlayerProfilesState): PlayerProfile | undefined {
  return state.profiles.find(profile => profile.id === state.activeProfileId);
};

export const createPlayerProfile = function(
  state: PlayerProfilesState,
  requestedName: string,
  id: string,
): PlayerProfilesResult {
  if (state.profiles.length >= MAX_PLAYER_PROFILES) return { state, error: 'atCapacity' };
  const name = validatePlayerName(requestedName, state.profiles);
  if (name.error) return { state, error: name.error };
  const learnerData = state.profiles.length === 0 ? state.initialLearnerData : initialPlayerLearnerData();
  const profile: PlayerProfile = { id, name: name.name, ...learnerData };
  const profiles = [...state.profiles, profile];
  return {
    state: {
      ...state,
      profiles,
      activeProfileId: id,
      initialLearnerData: initialPlayerLearnerData(),
    },
  };
};

export const switchActivePlayerProfile = function(
  state: PlayerProfilesState,
  profileId: string,
): PlayerProfilesResult {
  if (!state.profiles.some(profile => profile.id === profileId)) return { state, error: 'notFound' };
  return {
    state: {
      ...state,
      activeProfileId: profileId,
    },
  };
};

export const renamePlayerProfile = function(
  state: PlayerProfilesState,
  profileId: string,
  requestedName: string,
): PlayerProfilesResult {
  const current = state.profiles.find(profile => profile.id === profileId);
  if (!current) return { state, error: 'notFound' };
  const name = validatePlayerName(requestedName, state.profiles, profileId);
  if (name.error) return { state, error: name.error };
  const profiles = state.profiles.map(profile => profile.id === profileId
    ? { ...profile, name: name.name }
    : profile);
  return { state: { ...state, profiles } };
};

export const deletePlayerProfile = function(
  state: PlayerProfilesState,
  profileId: string,
): PlayerProfilesResult {
  const profile = state.profiles.find(candidate => candidate.id === profileId);
  if (!profile) return { state, error: 'notFound' };
  if (state.profiles.length <= 1) return { state, error: 'onlyPlayer' };
  const profiles = state.profiles.filter(candidate => candidate.id !== profileId);
  const deletingActive = state.activeProfileId === profileId;
  const replacement = deletingActive ? profiles[0] : undefined;
  if (deletingActive && !replacement) return { state, error: 'onlyPlayer' };
  return {
    state: {
      ...state,
      profiles,
      activeProfileId: replacement?.id ?? state.activeProfileId,
    },
  };
};

export const updateActivePlayerProfile = function(
  state: PlayerProfilesState,
  update: (profile: PlayerProfile) => PlayerProfile,
): PlayerProfilesState {
  const active = activePlayerProfile(state);
  if (!active) return state;
  const updated = update(active);
  if (updated === active) return state;
  const profiles = state.profiles.map(profile => profile.id === active.id ? updated : profile);
  return { ...state, profiles };
};

export const operationProgressForProfile = function(
  profile: PlayerProfile,
): ReadonlyArray<Readonly<{ operation: EquationOperation; highestUnlockedStep: number }>> {
  return OPERATIONS.map(operation => ({
    operation,
    highestUnlockedStep: profile.mathProgress[operation].highestUnlockedStep,
  }));
};

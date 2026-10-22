import { MATH_PROGRESS_KEY } from '../ecs/mathProgressStore';
import { SKIT_PROGRESS_KEY } from '../ecs/skitProgress';
import { ONBOARDING_STORAGE_KEYS } from '../onboarding/gameplayOnboarding';
import { ACTIVE_PLAYER_PROFILE_KEY, PLAYER_PROFILES_KEY, legacyLearnerData, parsedProfileStore, serializedProfileStore } from './codec';
import * as rules from './rules';
import type { PlayerProfile, PlayerProfilesResult, PlayerProfilesState } from './types';

export type ProfileStorage = Readonly<{
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}>;

type StorageRead = Readonly<{ ok: true; value: string | null }> | Readonly<{ ok: false }>;

const safeRead = function(storage: ProfileStorage, key: string): StorageRead {
  try {
    return { ok: true, value: storage.getItem(key) };
  } catch {
    return { ok: false };
  }
};

const safeWrite = function(storage: ProfileStorage | undefined, key: string, value: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const emptyState = function(): PlayerProfilesState {
  return {
    profiles: [], activeProfileId: null, initialLearnerData: rules.initialPlayerLearnerData(),
    persistence: 'session-only', canPersist: false,
  };
};

export const loadPlayerProfiles = function(storage?: ProfileStorage): PlayerProfilesState {
  const empty = emptyState();
  if (!storage) return empty;
  const storedProfiles = safeRead(storage, PLAYER_PROFILES_KEY);
  if (!storedProfiles.ok) return empty;
  if (storedProfiles.value === null) {
    const math = safeRead(storage, MATH_PROGRESS_KEY);
    const skits = safeRead(storage, SKIT_PROGRESS_KEY);
    const basics = safeRead(storage, ONBOARDING_STORAGE_KEYS.basics);
    const operands = safeRead(storage, ONBOARDING_STORAGE_KEYS.operands);
    const operandAndResult = safeRead(storage, ONBOARDING_STORAGE_KEYS.operandAndResult);
    const complete = [math, skits, basics, operands, operandAndResult].every(read => read.ok);
    return {
      ...empty,
      initialLearnerData: legacyLearnerData({
        math: math.ok ? math.value : null,
        skits: skits.ok ? skits.value : null,
        onboarding: {
          basics: basics.ok ? basics.value : null,
          operands: operands.ok ? operands.value : null,
          operandAndResult: operandAndResult.ok ? operandAndResult.value : null,
        },
      }),
      persistence: complete ? 'persistent' : 'session-only',
      canPersist: complete,
    };
  }
  const parsed = parsedProfileStore(storedProfiles.value);
  if (!parsed) return empty;
  const activeRead = safeRead(storage, ACTIVE_PLAYER_PROFILE_KEY);
  const savedActiveId = activeRead.ok ? activeRead.value : null;
  const activeProfileId = parsed.profiles.some(profile => profile.id === savedActiveId)
    ? savedActiveId
    : parsed.profiles[0]?.id ?? null;
  if (activeProfileId !== null && activeProfileId !== savedActiveId) {
    safeWrite(storage, ACTIVE_PLAYER_PROFILE_KEY, activeProfileId);
  }
  // Active-ID repair has always been best effort; only the profile envelope
  // determines load protection and status here.
  return {
    ...empty, profiles: parsed.profiles, activeProfileId,
    persistence: parsed.containsOnlyInvalidProfiles ? 'session-only' : 'persistent',
    canPersist: !parsed.containsOnlyInvalidProfiles,
  };
};

const saveProfiles = function(state: PlayerProfilesState, storage: ProfileStorage | undefined): PlayerProfilesState {
  const saved = state.canPersist && safeWrite(storage, PLAYER_PROFILES_KEY, serializedProfileStore(state.profiles));
  return { ...state, persistence: saved ? 'persistent' : 'session-only' };
};

export const createPlayerProfile = function(
  state: PlayerProfilesState, name: string, id: string, storage?: ProfileStorage,
): PlayerProfilesResult {
  const result = rules.createPlayerProfile(state, name, id);
  if (result.error) return result;
  const saved = saveProfiles(result.state, storage);
  // Retain the active-ID attempt even after a failed or protected profile write.
  const activeSaved = safeWrite(storage, ACTIVE_PLAYER_PROFILE_KEY, id);
  return { state: { ...saved, persistence: activeSaved ? saved.persistence : 'session-only' } };
};

export const switchActivePlayerProfile = function(
  state: PlayerProfilesState, id: string, storage?: ProfileStorage,
): PlayerProfilesResult {
  const result = rules.switchActivePlayerProfile(state, id);
  if (result.error) return result;
  const activeSaved = safeWrite(storage, ACTIVE_PLAYER_PROFILE_KEY, id);
  return { state: { ...result.state, persistence: activeSaved ? state.persistence : 'session-only' } };
};

export const renamePlayerProfile = function(
  state: PlayerProfilesState, id: string, name: string, storage?: ProfileStorage,
): PlayerProfilesResult {
  const result = rules.renamePlayerProfile(state, id, name);
  return result.error ? result : { state: saveProfiles(result.state, storage) };
};

export const deletePlayerProfile = function(
  state: PlayerProfilesState, id: string, storage?: ProfileStorage,
): PlayerProfilesResult {
  const result = rules.deletePlayerProfile(state, id);
  if (result.error) return result;
  if (!state.canPersist) return { state, error: 'profilesNotPersisted' };
  const next = result.state;
  if (state.activeProfileId === id && next.activeProfileId !== null
    && !safeWrite(storage, ACTIVE_PLAYER_PROFILE_KEY, next.activeProfileId)) {
    return { state, error: 'activeProfileNotPersisted' };
  }
  const saved = saveProfiles(next, storage);
  if (saved.persistence === 'session-only') {
    // The active-ID write may already be committed. Keep both records usable
    // while reflecting the replacement active player and the failed deletion.
    return {
      state: { ...state, activeProfileId: next.activeProfileId, persistence: 'session-only' },
      error: 'profilesNotPersisted',
    };
  }
  return { state: saved };
};

export const updateActivePlayerProfile = function(
  state: PlayerProfilesState, update: (profile: PlayerProfile) => PlayerProfile, storage?: ProfileStorage,
): PlayerProfilesState {
  const next = rules.updateActivePlayerProfile(state, update);
  return next === state ? state : saveProfiles(next, storage);
};

// Resolve the adapter per operation, preserving recovery if platform storage
// becomes available again. This service owns no mutable profile state.
export type ProfilePersistence = Readonly<{
  load: () => PlayerProfilesState;
  create: (state: PlayerProfilesState, name: string, id: string) => PlayerProfilesResult;
  switchActive: (state: PlayerProfilesState, id: string) => PlayerProfilesResult;
  rename: (state: PlayerProfilesState, id: string, name: string) => PlayerProfilesResult;
  delete: (state: PlayerProfilesState, id: string) => PlayerProfilesResult;
  updateActive: (state: PlayerProfilesState, update: (profile: PlayerProfile) => PlayerProfile) => PlayerProfilesState;
}>;

export const createProfilePersistence = function(storage: () => ProfileStorage | undefined): ProfilePersistence {
  return {
    load: (): PlayerProfilesState => loadPlayerProfiles(storage()),
    create: (state: PlayerProfilesState, name: string, id: string): PlayerProfilesResult => createPlayerProfile(state, name, id, storage()),
    switchActive: (state: PlayerProfilesState, id: string): PlayerProfilesResult => switchActivePlayerProfile(state, id, storage()),
    rename: (state: PlayerProfilesState, id: string, name: string): PlayerProfilesResult => renamePlayerProfile(state, id, name, storage()),
    delete: (state: PlayerProfilesState, id: string): PlayerProfilesResult => deletePlayerProfile(state, id, storage()),
    updateActive: (state: PlayerProfilesState, update: (profile: PlayerProfile) => PlayerProfile): PlayerProfilesState => updateActivePlayerProfile(state, update, storage()),
  };
};

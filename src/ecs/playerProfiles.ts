import type { EquationOperation } from './types';
import {
  initialSavedMathProgress,
  MATH_PROGRESS_KEY,
  MATH_PROGRESS_VERSION,
  mathProgressFromStoredValue,
  type MathProgressPersistence,
  type SavedMathProgress,
} from './mathProgressStore';
import {
  SKIT_PROGRESS_KEY,
  skitProgressFromStoredValue,
  type SkitProgress,
} from './skitProgress';
import {
  ONBOARDING_STORAGE_KEYS,
  onboardingCompletionFromStoredValue,
  type GameplayOnboardingCompletion,
  type GameplayOnboardingKind,
} from '../onboarding/gameplayOnboarding';

export const PLAYER_PROFILES_KEY = 'math-marsh.player-profiles';
export const ACTIVE_PLAYER_PROFILE_KEY = 'math-marsh.active-player-profile';
export const PLAYER_PROFILES_VERSION = 1;
export const MAX_PLAYER_PROFILES = 10;
export const PLAYER_NAME_MAX_LENGTH = 20;

export type PlayerLearnerData = Readonly<{
  mathProgress: SavedMathProgress;
  onboarding: Readonly<Record<GameplayOnboardingKind, GameplayOnboardingCompletion>>;
  skitProgress: SkitProgress;
}>;

export type PlayerProfile = PlayerLearnerData & Readonly<{
  id: string;
  name: string;
}>;

export type PlayerProfilesState = Readonly<{
  profiles: readonly PlayerProfile[];
  activeProfileId: string | null;
  initialLearnerData: PlayerLearnerData;
  persistence: MathProgressPersistence;
  canPersist: boolean;
}>;

export type ProfileStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type PlayerNameError = 'blank' | 'duplicate' | 'tooLong';
export type PlayerProfilesError = PlayerNameError
  | 'atCapacity'
  | 'notFound'
  | 'onlyPlayer'
  | 'activeProfileNotPersisted'
  | 'profilesNotPersisted';

export type PlayerProfilesResult = Readonly<{
  state: PlayerProfilesState;
  error?: PlayerProfilesError;
}>;

const ONBOARDING_KINDS: readonly GameplayOnboardingKind[] = [
  'basics',
  'operands',
  'operandAndResult',
];

const OPERATIONS: readonly EquationOperation[] = ['add', 'subtract', 'multiply', 'divide'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const serializedValue = (value: unknown): string | null => JSON.stringify(value) ?? null;

const freshOnboarding = (): PlayerLearnerData['onboarding'] => ({
  basics: 'pending',
  operands: 'pending',
  operandAndResult: 'pending',
});

export const initialPlayerLearnerData = function(): PlayerLearnerData {
  return {
    mathProgress: initialSavedMathProgress(),
    onboarding: freshOnboarding(),
    skitProgress: [],
  };
};

const browserStorage = (): ProfileStorage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.mathMarshDesktop?.profileStorage ?? window.localStorage;
  } catch {
    return undefined;
  }
};

type StorageRead = Readonly<{ ok: true; value: string | null }> | Readonly<{ ok: false }>;

const safeRead = (storage: ProfileStorage, key: string): StorageRead => {
  try {
    return { ok: true, value: storage.getItem(key) };
  } catch {
    return { ok: false };
  }
};

const safeWrite = (storage: ProfileStorage | undefined, key: string, value: string): boolean => {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const legacyLearnerData = function(storage: ProfileStorage): Readonly<{
  data: PlayerLearnerData;
  complete: boolean;
}> {
  const keys = [MATH_PROGRESS_KEY, SKIT_PROGRESS_KEY, ...ONBOARDING_KINDS.map(kind => ONBOARDING_STORAGE_KEYS[kind])];
  const reads = keys.map(key => safeRead(storage, key));
  const [mathRead, skitRead, ...onboardingReads] = reads;
  const mathStored = mathRead?.ok ? mathRead.value : null;
  const skitsStored = skitRead?.ok ? skitRead.value : null;
  const onboarding = Object.fromEntries(ONBOARDING_KINDS.map((kind, index) => {
    const stored = onboardingReads[index];
    return [kind, onboardingCompletionFromStoredValue(stored?.ok ? stored.value : null)];
  })) as Record<GameplayOnboardingKind, GameplayOnboardingCompletion>;
  return {
    data: {
      mathProgress: mathProgressFromStoredValue(mathStored),
      onboarding,
      skitProgress: skitProgressFromStoredValue(skitsStored),
    },
    complete: reads.every(read => read.ok),
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

const learnerDataFromUnknown = (value: unknown): PlayerLearnerData | undefined => {
  if (!isRecord(value)) return undefined;
  const math = isRecord(value.mathProgress)
    ? serializedValue({ version: MATH_PROGRESS_VERSION, tracks: value.mathProgress })
    : null;
  const skits = Array.isArray(value.skitProgress) ? serializedValue(value.skitProgress) : null;
  const onboarding = isRecord(value.onboarding) ? value.onboarding : {};
  return {
    mathProgress: mathProgressFromStoredValue(math),
    onboarding: Object.fromEntries(ONBOARDING_KINDS.map(kind => [
      kind,
      onboardingCompletionFromStoredValue(
        typeof onboarding[kind] === 'string' ? onboarding[kind] : null,
      ),
    ])) as Record<GameplayOnboardingKind, GameplayOnboardingCompletion>,
    skitProgress: skitProgressFromStoredValue(skits),
  };
};

const profileFromUnknown = (value: unknown): PlayerProfile | undefined => {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.trim().length === 0) return undefined;
  if (typeof value.name !== 'string') return undefined;
  const learnerData = learnerDataFromUnknown(value.learnerData);
  if (!learnerData) return undefined;
  const validatedName = validatePlayerName(value.name, []);
  if (validatedName.error) return undefined;
  return { id: value.id, name: validatedName.name, ...learnerData };
};

type ParsedProfileStore = Readonly<{
  profiles: readonly PlayerProfile[];
  containsOnlyInvalidProfiles: boolean;
}>;

const parsedProfileStore = (stored: string): ParsedProfileStore | undefined => {
  try {
    const value: unknown = JSON.parse(stored);
    if (!isRecord(value) || value.version !== PLAYER_PROFILES_VERSION || !Array.isArray(value.profiles)) return undefined;
    const records: unknown[] = value.profiles;
    const parsed = records.map(profileFromUnknown).filter((profile): profile is PlayerProfile => profile !== undefined);
    const profiles = parsed.filter((profile, index, candidates) =>
      candidates.findIndex(candidate => candidate.id === profile.id) === index
      && candidates.findIndex(candidate => candidate.name.toLowerCase() === profile.name.toLowerCase()) === index,
    ).slice(0, MAX_PLAYER_PROFILES);
    return {
      profiles,
      containsOnlyInvalidProfiles: value.profiles.length > 0 && profiles.length === 0,
    };
  } catch {
    return undefined;
  }
};

const stateWith = function(
  profiles: readonly PlayerProfile[],
  activeProfileId: string | null,
  initialLearnerData: PlayerLearnerData,
  persistence: MathProgressPersistence,
  canPersist: boolean,
): PlayerProfilesState {
  return { profiles, activeProfileId, initialLearnerData, persistence, canPersist };
};

export const loadPlayerProfiles = function(
  storage: ProfileStorage | undefined = browserStorage(),
): PlayerProfilesState {
  if (!storage) return stateWith([], null, initialPlayerLearnerData(), 'session-only', false);
  const storedProfiles = safeRead(storage, PLAYER_PROFILES_KEY);
  if (!storedProfiles.ok) return stateWith([], null, initialPlayerLearnerData(), 'session-only', false);
  if (storedProfiles.value === null) {
    const legacy = legacyLearnerData(storage);
    return stateWith([], null, legacy.data, legacy.complete ? 'persistent' : 'session-only', legacy.complete);
  }
  const parsed = parsedProfileStore(storedProfiles.value);
  if (!parsed) return stateWith([], null, initialPlayerLearnerData(), 'session-only', false);
  const activeRead = safeRead(storage, ACTIVE_PLAYER_PROFILE_KEY);
  const savedActiveId = activeRead.ok ? activeRead.value : null;
  const activeProfileId = parsed.profiles.some(profile => profile.id === savedActiveId)
    ? savedActiveId
    : parsed.profiles[0]?.id ?? null;
  if (activeProfileId !== null && activeProfileId !== savedActiveId) {
    safeWrite(storage, ACTIVE_PLAYER_PROFILE_KEY, activeProfileId);
  }
  return stateWith(
    parsed.profiles,
    activeProfileId,
    initialPlayerLearnerData(),
    parsed.containsOnlyInvalidProfiles ? 'session-only' : 'persistent',
    !parsed.containsOnlyInvalidProfiles,
  );
};

export const activePlayerProfile = function(state: PlayerProfilesState): PlayerProfile | undefined {
  return state.profiles.find(profile => profile.id === state.activeProfileId);
};

const serializedProfileStore = (profiles: readonly PlayerProfile[]): string => JSON.stringify({
  version: PLAYER_PROFILES_VERSION,
  profiles: profiles.map(profile => ({
    id: profile.id,
    name: profile.name,
    learnerData: {
      mathProgress: profile.mathProgress,
      onboarding: profile.onboarding,
      skitProgress: profile.skitProgress,
    },
  })),
});

const stateWithSavedProfiles = function(
  state: PlayerProfilesState,
  profiles: readonly PlayerProfile[],
  storage: ProfileStorage | undefined,
): PlayerProfilesState {
  const saved = state.canPersist && safeWrite(storage, PLAYER_PROFILES_KEY, serializedProfileStore(profiles));
  return {
    ...state,
    profiles,
    persistence: saved ? 'persistent' : 'session-only',
  };
};

export const createPlayerProfile = function(
  state: PlayerProfilesState,
  requestedName: string,
  id: string,
  storage: ProfileStorage | undefined = browserStorage(),
): PlayerProfilesResult {
  if (state.profiles.length >= MAX_PLAYER_PROFILES) return { state, error: 'atCapacity' };
  const name = validatePlayerName(requestedName, state.profiles);
  if (name.error) return { state, error: name.error };
  const learnerData = state.profiles.length === 0 ? state.initialLearnerData : initialPlayerLearnerData();
  const profile: PlayerProfile = { id, name: name.name, ...learnerData };
  const profiles = [...state.profiles, profile];
  const saved = stateWithSavedProfiles(state, profiles, storage);
  const activeSaved = safeWrite(storage, ACTIVE_PLAYER_PROFILE_KEY, id);
  return {
    state: {
      ...saved,
      activeProfileId: id,
      initialLearnerData: initialPlayerLearnerData(),
      persistence: activeSaved ? saved.persistence : 'session-only',
    },
  };
};

export const switchActivePlayerProfile = function(
  state: PlayerProfilesState,
  profileId: string,
  storage: ProfileStorage | undefined = browserStorage(),
): PlayerProfilesResult {
  if (!state.profiles.some(profile => profile.id === profileId)) return { state, error: 'notFound' };
  const activeSaved = safeWrite(storage, ACTIVE_PLAYER_PROFILE_KEY, profileId);
  return {
    state: {
      ...state,
      activeProfileId: profileId,
      persistence: activeSaved ? state.persistence : 'session-only',
    },
  };
};

export const renamePlayerProfile = function(
  state: PlayerProfilesState,
  profileId: string,
  requestedName: string,
  storage: ProfileStorage | undefined = browserStorage(),
): PlayerProfilesResult {
  const current = state.profiles.find(profile => profile.id === profileId);
  if (!current) return { state, error: 'notFound' };
  const name = validatePlayerName(requestedName, state.profiles, profileId);
  if (name.error) return { state, error: name.error };
  const profiles = state.profiles.map(profile => profile.id === profileId
    ? { ...profile, name: name.name }
    : profile);
  return { state: stateWithSavedProfiles(state, profiles, storage) };
};

export const deletePlayerProfile = function(
  state: PlayerProfilesState,
  profileId: string,
  storage: ProfileStorage | undefined = browserStorage(),
): PlayerProfilesResult {
  const profile = state.profiles.find(candidate => candidate.id === profileId);
  if (!profile) return { state, error: 'notFound' };
  if (state.profiles.length <= 1) return { state, error: 'onlyPlayer' };
  if (!state.canPersist) return { state, error: 'profilesNotPersisted' };
  const profiles = state.profiles.filter(candidate => candidate.id !== profileId);
  const deletingActive = state.activeProfileId === profileId;
  const replacement = deletingActive ? profiles[0] : undefined;
  if (deletingActive && !replacement) return { state, error: 'onlyPlayer' };
  if (replacement && !safeWrite(storage, ACTIVE_PLAYER_PROFILE_KEY, replacement.id)) {
    return { state, error: 'activeProfileNotPersisted' };
  }
  const saved = state.canPersist && safeWrite(storage, PLAYER_PROFILES_KEY, serializedProfileStore(profiles));
  if (!saved && state.canPersist) {
    return {
      state: { ...state, activeProfileId: replacement?.id ?? state.activeProfileId, persistence: 'session-only' },
      error: 'profilesNotPersisted',
    };
  }
  if (!state.canPersist) return { state, error: 'profilesNotPersisted' };
  return {
    state: {
      ...state,
      profiles,
      activeProfileId: replacement?.id ?? state.activeProfileId,
      persistence: 'persistent',
    },
  };
};

export const updateActivePlayerProfile = function(
  state: PlayerProfilesState,
  update: (profile: PlayerProfile) => PlayerProfile,
  storage: ProfileStorage | undefined = browserStorage(),
): PlayerProfilesState {
  const active = activePlayerProfile(state);
  if (!active) return state;
  const updated = update(active);
  if (updated === active) return state;
  const profiles = state.profiles.map(profile => profile.id === active.id ? updated : profile);
  return stateWithSavedProfiles(state, profiles, storage);
};

export const createPlayerProfileId = function(): string {
  try {
    const cryptoApi = globalThis.crypto;
    if (typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  } catch {
    // Fall through to the local generator when platform crypto is unavailable.
  }
  return `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export const operationProgressForProfile = function(
  profile: PlayerProfile,
): ReadonlyArray<Readonly<{ operation: EquationOperation; highestUnlockedStep: number }>> {
  return OPERATIONS.map(operation => ({
    operation,
    highestUnlockedStep: profile.mathProgress[operation].highestUnlockedStep,
  }));
};

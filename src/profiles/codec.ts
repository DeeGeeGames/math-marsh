import { emptyPracticeProgress, parsePracticeProgress, serializePracticeProgress } from '../ecs/practiceProgress';
import { MATH_PROGRESS_VERSION, mathProgressFromStoredValue } from '../ecs/mathProgressStore';
import { skitProgressFromStoredValue } from '../ecs/skitProgress';
import { onboardingCompletionFromStoredValue } from '../onboarding/gameplayOnboarding';
import type { PlayerLearnerData, PlayerProfile } from './types';
import { MAX_PLAYER_PROFILES, validatePlayerName } from './rules';

export const PLAYER_PROFILES_KEY = 'math-marsh.player-profiles';
export const ACTIVE_PLAYER_PROFILE_KEY = 'math-marsh.active-player-profile';
export const PLAYER_PROFILES_VERSION = 1;

const isRecord = function(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const serializedValue = function(value: unknown): string | null {
  return JSON.stringify(value) ?? null;
};

export type LegacyLearnerValues = Readonly<{
  math: string | null;
  skits: string | null;
  onboarding: Readonly<{ basics: string | null; operands: string | null; operandAndResult: string | null }>;
}>;

export const legacyLearnerData = function(values: LegacyLearnerValues): PlayerLearnerData {
  return {
    mathProgress: mathProgressFromStoredValue(values.math),
    skitProgress: skitProgressFromStoredValue(values.skits),
    onboarding: {
      basics: onboardingCompletionFromStoredValue(values.onboarding.basics),
      operands: onboardingCompletionFromStoredValue(values.onboarding.operands),
      operandAndResult: onboardingCompletionFromStoredValue(values.onboarding.operandAndResult),
    },
    practiceProgress: emptyPracticeProgress(),
  };
};

const learnerDataFromUnknown = function(value: unknown): PlayerLearnerData | undefined {
  if (!isRecord(value)) return undefined;
  const math = isRecord(value.mathProgress)
    ? serializedValue({ version: MATH_PROGRESS_VERSION, tracks: value.mathProgress })
    : null;
  const skits = Array.isArray(value.skitProgress) ? serializedValue(value.skitProgress) : null;
  const onboarding = isRecord(value.onboarding) ? value.onboarding : {};
  return {
    mathProgress: mathProgressFromStoredValue(math),
    onboarding: {
      basics: onboardingCompletionFromStoredValue(typeof onboarding.basics === 'string' ? onboarding.basics : null),
      operands: onboardingCompletionFromStoredValue(typeof onboarding.operands === 'string' ? onboarding.operands : null),
      operandAndResult: onboardingCompletionFromStoredValue(typeof onboarding.operandAndResult === 'string' ? onboarding.operandAndResult : null),
    },
    skitProgress: skitProgressFromStoredValue(skits),
    practiceProgress: parsePracticeProgress(value.practiceProgress),
  };
};

const profileFromUnknown = function(value: unknown): PlayerProfile | undefined {
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

export const parsedProfileStore = function(stored: string): ParsedProfileStore | undefined {
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

export const serializedProfileStore = function(profiles: readonly PlayerProfile[]): string {
  return JSON.stringify({
    version: PLAYER_PROFILES_VERSION,
    profiles: profiles.map(profile => ({
      id: profile.id,
      name: profile.name,
      learnerData: {
        mathProgress: profile.mathProgress,
        onboarding: profile.onboarding,
        skitProgress: profile.skitProgress,
        practiceProgress: serializePracticeProgress(profile.practiceProgress),
      },
    })),
  });
};


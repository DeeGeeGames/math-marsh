import type { PracticeProgress } from '../ecs/practiceProgress';
import type { MathProgressPersistence, SavedMathProgress } from '../ecs/mathProgressStore';
import type { SkitProgress } from '../ecs/skitProgress';
import type { GameplayOnboardingCompletion, GameplayOnboardingKind } from '../onboarding/gameplayOnboarding';

export type PlayerLearnerData = Readonly<{
  mathProgress: SavedMathProgress;
  onboarding: Readonly<Record<GameplayOnboardingKind, GameplayOnboardingCompletion>>;
  skitProgress: SkitProgress;
  practiceProgress: PracticeProgress;
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


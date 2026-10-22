// Compatibility imports for existing tests/tools. Application code uses the
// profile feature directly; storage functions here have no platform defaults.
export * from '../profiles/types';
export { MAX_PLAYER_PROFILES, PLAYER_NAME_MAX_LENGTH, initialPlayerLearnerData,
  validatePlayerName, nextDefaultPlayerName, activePlayerProfile, operationProgressForProfile } from '../profiles/rules';
export { PLAYER_PROFILES_KEY, ACTIVE_PLAYER_PROFILE_KEY, PLAYER_PROFILES_VERSION } from '../profiles/codec';
export { loadPlayerProfiles, createPlayerProfile, switchActivePlayerProfile,
  renamePlayerProfile, deletePlayerProfile, updateActivePlayerProfile, type ProfileStorage } from '../profiles/persistence';
export { createPlayerProfileId } from '../platform/profileStorage';

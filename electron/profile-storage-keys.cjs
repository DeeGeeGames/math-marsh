// Only portable learning data belongs in the cloud save. Keep settings local.
const PROFILE_STORAGE_KEYS = Object.freeze([
	'math-marsh.player-profiles',
	'math-marsh.active-player-profile',
	'math-marsh-practice-progress',
	'math-marsh-scenes',
	'math-marsh.gameplayOnboarding',
	'math-marsh.operandOnboarding',
	'math-marsh.operandAndResultOnboarding',
]);

module.exports = { PROFILE_STORAGE_KEYS };

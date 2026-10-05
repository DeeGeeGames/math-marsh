import { IMAGE_ASSET_KEYS, type ImageAssetKey } from '../ecs/assets';
import { ANIMATION_CONFIG } from '../config';
import { ANSWER_CONSUMPTION_DURATION_MS } from '../ecs/systemConfigs';
import type { AudioScene, SoundEffect } from '../audio/audio';

export const CHARACTERS = ['Fly', 'Frog', 'Lizard', 'Spider'] as const;
export type Character = typeof CHARACTERS[number];
export type SpritePreview = {
	key: ImageAssetKey;
	character: Character;
	label: string;
	frameCount: number;
	fps: number;
};

export const SPRITES: readonly SpritePreview[] = CHARACTERS.flatMap(function(character) {
	const prefix = character.toLowerCase();
	return IMAGE_ASSET_KEYS.filter(function(key) { return key.startsWith(prefix); }).map(function(key) {
		const frameCount = key.endsWith('Image') ? 1 : key.includes('MouthOpen') ? 4 : 8;
		const duration = key.includes('Turn') ? 0.18
			: key.includes('MouthOpen') ? 0.16
			: key.includes('Eat') ? ANSWER_CONSUMPTION_DURATION_MS / 1000
			: character === 'Fly' ? 8 / 24 : ANIMATION_CONFIG.MOVEMENT_DURATION / 1000;
		return {
			key, character, frameCount,
			label: key.slice(prefix.length).replace(/([A-Z])/g, ' $1').trim(),
			fps: key === 'flyEatAway' ? 12 : frameCount / duration,
		};
	});
});

export const MUSIC = [
	{ label: 'Title', scene: 'title', lowTime: false },
	{ label: 'Gameplay', scene: 'game', lowTime: false },
	{ label: 'Gameplay · low time warning', scene: 'game', lowTime: true },
	{ label: 'Cutscene', scene: 'cutscene', lowTime: false },
] as const satisfies readonly { label: string; scene: AudioScene; lowTime: boolean }[];

export const EFFECTS = {
	uiBack: 'UI back', uiSelect: 'UI select', move: 'Move',
	answerSelect: 'Answer select', answerDeselect: 'Answer deselect',
	correct: 'Correct answer', incorrect: 'Incorrect answer', damage: 'Damage',
	web: 'Spider web', frogTongue: 'Frog tongue',
	levelComplete: 'Level complete', gameOver: 'Game over',
} as const satisfies Record<SoundEffect, string>;

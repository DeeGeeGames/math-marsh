import type { SoundEffect } from '../audio/audio';

export const SPLASH_CELEBRATION_SECONDS = 1.2;

export const splashTitle = function(count: number): string {
	return count >= 4 ? 'SUPER SPLASH!' : count === 3 ? 'TRIPLE SPLASH!' : 'DOUBLE SPLASH!';
};

export const splashSound = function(count: number): SoundEffect {
	return count >= 4 ? 'superSplash' : count === 3 ? 'tripleSplash' : 'doubleSplash';
};

/** The rounded end leads; the pointed tail follows the trajectory tangent. */
export const splashDropletPose = function(side: number, lane: number, progress: number): {
	x: number; y: number; rotation: number;
} {
	const speed = 18 + lane * 12;
	const height = 20 + lane * 10;
	const velocityX = side * speed;
	const velocityY = -height * Math.PI * Math.cos(Math.PI * progress);
	return {
		x: side * (28 + speed * progress),
		y: -5 - height * Math.sin(Math.PI * progress),
		rotation: Math.atan2(velocityY, velocityX) - Math.PI / 2,
	};
};

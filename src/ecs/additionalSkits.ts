// Scene poses are percentages of the stage. The ECS screen remains the sole clock.
export type ScenePose = { x: number; y: number; tilt: number; visible: boolean; frame: number; facing: 1 | -1 };
export type AdditionalSkitPresentation = {
	fly: ScenePose; frog: ScenePose; spider: ScenePose; lizard: ScenePose;
	pad: ScenePose; splash: boolean; web: boolean; webTilt: number; webBuild: number; pluck: boolean;
	diagram: boolean; tongue: boolean; caption: string;
	hat: boolean; burst: string; tongueReach: number;
};
export const ADDITIONAL_SKIT_DURATION_SECONDS = 16;
const progress = function(time: number, start: number, duration: number): number {
	return Math.max(0, Math.min(1, (time - start) / duration));
};
const ease = function(time: number, start: number, duration: number): number {
	const t = progress(time, start, duration);
	return t * t * (3 - 2 * t);
};
const pose = function(x: number, y: number, tilt = 0, visible = true): ScenePose {
	return { x, y, tilt, visible, frame: 0, facing: 1 };
};
const flying = function(time: number, x: number, y: number, reducedMotion: boolean, facing: 1 | -1 = 1): ScenePose {
	return { ...pose(x, y + (reducedMotion ? 0 : Math.sin(time * 4) * 1.2)), frame: reducedMotion ? 0 : Math.floor(time * 24) % 8, facing };
};
const emptyScene = function(): AdditionalSkitPresentation {
	return {
		fly: pose(75, 25), frog: pose(20, 72, 0, false), spider: pose(50, 50, 0, false),
		lizard: pose(20, 70, 0, false), pad: pose(65, 75, 0, false),
		splash: false, web: false, webTilt: 0, webBuild: 1, pluck: false, diagram: false, tongue: false,
		hat: false, burst: '', tongueReach: 0, caption: '',
	};
};
export const shortcutPresentation = function(time: number, reducedMotion = false): AdditionalSkitPresentation {
	const crossing = ease(time, 3, 1.5);
	const jump = progress(time, 5, 1.4);
	const emerged = time >= 7.4;
	const rise = ease(time, 7.4, .8);
	const proud = emerged && !reducedMotion ? Math.sin(time * 3) * 3 : 0;
	return {
		...emptyScene(),
		fly: flying(time, 34 + crossing * 47 + ease(time, 14.6, 1.4) * 35, 30, reducedMotion, time >= 4.5 && time < 14.6 ? -1 : 1),
		lizard: pose(20 + ease(time, 5, 1.4) * 38, emerged ? 95 - rise * 19 : 73 - (reducedMotion ? 0 : Math.sin(jump * Math.PI) * 22), proud, time < 6.4 || emerged),
		pad: pose(emerged ? 58 : 65, emerged ? 56 : 81, emerged ? -12 : 0),
		hat: emerged,
		splash: time >= 6.4 && time < 7.4,
		burst: time >= 6.4 && time < 7.4 ? 'SPLOOSH!' : '',
		caption: time < 3 ? 'Lizard: “Watch my BIG jump!”'
			: time < 5 ? 'Fly: “I’ll meet you over there!”'
			: time < 7.5 ? 'Lizard: “One, two… WHEEE!”'
			: time < 11 ? 'Lizard: “Ta-da! I’m a lily pad!”'
			: 'Fly: “A lily pad with toes!”',
	};
};
export const doNotDisturbPresentation = function(time: number, reducedMotion = false): AdditionalSkitPresentation {
	const firstPluck = time >= 5.2 && time < 7;
	const secondPluck = time >= 11.3 && time < 13.8;
	const reaction = firstPluck || secondPluck;
	const sincePluck = time - (firstPluck ? 5.2 : 11.3);
	const wobble = reaction && !reducedMotion ? Math.sin(sincePluck * 13) * 11 * Math.exp(-sincePluck * 1.1) : 0;
	const approach = ease(time, 2.6, 1.2);
	return {
		...emptyScene(), web: true, webTilt: wobble / 4, webBuild: .85 + ease(time, 0, 1.5) * .15, pluck: reaction,
		spider: pose(47, 58 + wobble * .65, wobble),
		fly: flying(time, 85 - approach * 13 + ease(time, 14.6, 1.4) * 40, 32 + approach * 23, reducedMotion, time < 14.6 ? -1 : 1),
		burst: reaction ? '♪ TWANG! ♪' : '',
		caption: time < 3 ? 'Spider: “Time for a teeny-tiny nap.”'
			: time < 6 ? 'Fly: “Ooh! A tiny harp!”'
			: time < 9 ? 'Spider: “My web has the wiggles!”'
			: time < 12 ? 'Spider: “Again! Again!”'
			: 'Fly: “One bouncy lullaby!”',
	};
};
export const dinnerCommitteePresentation = function(time: number, reducedMotion = false): AdditionalSkitPresentation {
	const charge = ease(time, 6, .8);
	const rebound = ease(time, 7, .9);
	const collided = time >= 6.8 && time < 8;
	const extend = ease(time, 8.6, .3);
	const catchPad = ease(time, 9, .8);
	const shake = collided && !reducedMotion ? Math.sin((time - 6.8) * 18) * 5 * (1 - rebound) : 0;
	const reachMap = ease(time, 3, .8) * (1 - ease(time, 5, .7));
	const lizard = pose(80 - charge * 22 + rebound * 14, 82, shake);
	return {
		...emptyScene(), diagram: time < 8.6,
		fly: flying(time, 68 - reachMap * 11 + ease(time, 14.6, 1.4) * 44, 29 + reachMap * 24, reducedMotion, time < 14.6 ? -1 : 1),
		frog: pose(20 + charge * 22 - rebound * 12, 82, -shake),
		spider: pose(50, 43 + charge * 25 - rebound * 20, shake),
		lizard: { ...lizard, facing: -1, frame: reducedMotion || time < 6 || time >= 7.9 ? 0 : Math.floor(time * 12) % 8 },
		pad: pose(78 - catchPad * 34, 86 - catchPad * 6, catchPad * -12),
		tongue: extend > 0 && time < 9.8, tongueReach: extend,
		burst: collided ? 'BONK!' : '',
		caption: time < 3 ? 'Frog: “Team snack time!”'
			: time < 5.8 ? 'Fly: “Meet in the middle!”'
			: time < 8.6 ? 'Together: “Ready, steady… WHOOPS!”'
			: time < 12 ? 'Frog: “I caught lunch! …It’s a leaf.”'
			: 'Fly: “Picnic time! Who wants salad?”',
	};
};

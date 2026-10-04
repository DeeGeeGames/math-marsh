// Scene poses are percentages of the stage. The ECS screen remains the sole clock.
export type ScenePose = { x: number; y: number; tilt: number; visible: boolean; frame: number; facing: 1 | -1 };
export type AdditionalSkitPresentation = {
	fly: ScenePose; frog: ScenePose; spider: ScenePose; lizard: ScenePose;
	pad: ScenePose; splash: boolean; web: boolean; webTilt: number; webBuild: number; pluck: boolean;
	diagram: boolean; diagramTurn: number; tongue: boolean; caption: string;
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
		splash: false, web: false, webTilt: 0, webBuild: 1, pluck: false, diagram: false, diagramTurn: 0, tongue: false,
		hat: false, burst: '', tongueReach: 0, caption: '',
	};
};

// Lizard aims at the one pad in the gap. He goes through it and wears it.
export const shortcutPresentation = function(time: number, reducedMotion = false): AdditionalSkitPresentation {
	const cross = ease(time, 2.2, 2.2);
	const jump = ease(time, 6.2, 1.1);
	const airborne = time >= 6.2 && time < 7.3;
	const submerged = time >= 7.3 && time < 8.4;
	const emerged = time >= 8.4;
	const rise = ease(time, 8.4, 0.8);
	const jumpT = progress(time, 6.2, 1.1);
	const lizardX = 16 + jump * 32;
	const standingY = 78;
	const lizardY = emerged
		? 96 - rise * 20
		: standingY - (reducedMotion || !airborne ? 0 : Math.sin(jumpT * Math.PI) * 24);
	const proud = emerged && !reducedMotion ? Math.sin(time * 3) * 2 : 0;
	return {
		...emptyScene(),
		fly: flying(time, 18 + cross * 64, 30, reducedMotion, time >= 4.6 ? -1 : 1),
		lizard: {
			...pose(lizardX, lizardY, proud, !submerged),
			frame: reducedMotion || !airborne ? 0 : 3,
		},
		pad: pose(emerged ? lizardX : 50, emerged ? lizardY - 16 : 80, emerged ? -12 : 0),
		hat: emerged,
		splash: submerged,
		burst: submerged ? 'SPLOOSH!' : '',
		caption: time < 3.2 ? 'Lizard: “The middle pad is a shortcut.”'
			: time < 6.2 ? 'Fly: “You will not fit on it.”'
			: time < 8.4 ? 'Lizard: “I only need one jump.”'
			: time < 12 ? 'Lizard: “I reached the pad!”'
			: 'Fly: “It is on your head.”',
	};
};

// Spider set a trap and asked for quiet. Plucking the strand bounces him, so the noise is Spider.
export const doNotDisturbPresentation = function(time: number, reducedMotion = false): AdditionalSkitPresentation {
	const firstPluck = time >= 6.4 && time < 8.2;
	const secondPluck = time >= 9.6 && time < 11.4;
	const reaction = firstPluck || secondPluck;
	const sincePluck = time - (time >= 9.6 ? 9.6 : 6.4);
	const wobble = reaction && !reducedMotion ? Math.sin(sincePluck * 13) * 11 * Math.exp(-sincePluck * 1.1) : 0;
	const approach = ease(time, 3.2, 1.6);
	const leave = ease(time, 12.2, 1.6);
	return {
		...emptyScene(),
		web: true,
		webTilt: wobble / 4,
		webBuild: 0.85 + ease(time, 0, 1.2) * 0.15,
		pluck: reaction,
		spider: pose(48, 58 + wobble * 0.65, wobble),
		fly: flying(time, 84 - approach * 18 + leave * 46, 30 + approach * 22, reducedMotion, time < 12.2 ? -1 : 1),
		burst: reaction ? 'TWANG!' : '',
		caption: time < 3.2 ? 'Spider: “Quiet. This trap is set.”'
			: time < 6.4 ? 'Fly: “This string is loose.”'
			: time < 9.2 ? 'Spider: “Leave the trap alone!”'
			: time < 12 ? 'Fly: “Listen. It makes a sound.”'
			: 'Spider: “That sound is me!”',
	};
};

// The plan points at Fly. She turns the arrows around, the hunters follow them, and Frog catches another pad.
export const dinnerCommitteePresentation = function(time: number, reducedMotion = false): AdditionalSkitPresentation {
	const turn = ease(time, 5.2, 0.8);
	const charge = ease(time, 6.6, 0.8);
	const rebound = ease(time, 7.6, 0.8);
	const collided = time >= 7.4 && time < 8.3;
	const extend = ease(time, 8.5, 0.4);
	const catchPad = ease(time, 8.7, 0.6);
	const arrive = ease(time, 3.2, 1.4);
	const leave = ease(time, 6.4, 1.4);
	const shake = collided && !reducedMotion ? Math.sin((time - 7.4) * 18) * 4 * (1 - rebound) : 0;
	const frogX = 18 + charge * 6 - rebound * 8;
	const spiderX = 40 - charge * 14;
	const lizardX = 58 - charge * 26 + rebound * 18;
	const facingFly = time < 6.6;
	return {
		...emptyScene(),
		diagram: true,
		diagramTurn: reducedMotion ? (time >= 5.2 ? 1 : 0) : turn,
		fly: flying(time, 84 - arrive * 12 + leave * 10, 16 + arrive * 26 - leave * 20, reducedMotion, leave > 0 && leave < 1 ? 1 : -1),
		frog: { ...pose(frogX, 80, -shake), facing: time < 6.6 || time >= 8.4 ? 1 : -1 },
		spider: { ...pose(spiderX, 36 + charge * 22 - rebound * 16, shake), facing: facingFly ? 1 : -1 },
		lizard: {
			...pose(lizardX, 82, shake),
			facing: facingFly ? 1 : -1,
			frame: reducedMotion || facingFly || time >= 7.6 ? 0 : Math.floor(time * 12) % 8,
		},
		pad: pose(76 - catchPad * 50, 86 - catchPad * 28, catchPad * -18),
		tongue: extend > 0 && time < 12.2,
		tongueReach: time < 12.2 ? extend : 0,
		burst: collided ? 'BONK!' : '',
		caption: time < 3.2 ? 'Frog: “The arrows point at the fly.”'
			: time < 6.4 ? 'Fly: “I can turn the arrows.”'
			: time < 9.2 ? 'Together: “Follow the arrows!”'
			: time < 12 ? 'Frog: “Salad. Again.”'
			: 'Fly: “The arrows point at you.”',
	};
};

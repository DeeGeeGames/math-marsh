// Math Marsh intermission skits: dialogue tables, timelines, and registry entries.
//
// Holds all four skits: Snack Break (bespoke `SkitPresentation` staging in skitScreen.ts) and
// The Big Jump, The Web Guitar, and The Big Plan (generic `AdditionalSkitPresentation` staging on
// the `.skit-extra` layer). Also exports the shared scene types and `SKIT_ENTRIES`, which
// skitSequence.ts uses as `SKITS`.
//
// Each skit's dialogue lives in a BEATS table (speaker, start time, line), so writers can edit
// lines and timing without touching motion code. Captions keep the
// `Speaker: “line”` string format that skitScreen.ts `updateCaption` parses.

import type { SkitPresentation } from './skitSequence';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

// Scene poses are percentages of the stage. The ECS screen remains the sole clock.
export type ScenePose = { x: number; y: number; tilt: number; visible: boolean; frame: number; facing: 1 | -1 };
export type AdditionalSkitPresentation = {
	fly: ScenePose; frog: ScenePose; spider: ScenePose; lizard: ScenePose;
	pad: ScenePose; splash: boolean; web: boolean; webTilt: number; webBuild: number; pluck: boolean;
	diagram: boolean; tongue: boolean; caption: string;
	hat: boolean; burst: string; tongueReach: number;
};

// ---------------------------------------------------------------------------
// Script data
// ---------------------------------------------------------------------------

// Speakers must match the regex in skitScreen.ts updateCaption: Fly|Frog|Spider|Lizard|Together.
export type Speaker = 'Fly' | 'Frog' | 'Spider' | 'Lizard' | 'Together';
export type Beat = { readonly at: number; readonly speaker: Speaker; readonly line: string };

const captionAt = function(beats: readonly Beat[], time: number): string {
	let current = beats[0];
	for (const beat of beats) if (time >= beat.at) current = beat;
	return current ? `${current.speaker}: “${current.line}”` : '';
};

export const SNACK_BREAK_DURATION_SECONDS = 15.5;
export const SNACK_BREAK_BEATS = [
	{ at: 0, speaker: 'Frog', line: 'Ooh! A fly snack!' },
	{ at: 3, speaker: 'Frog', line: 'Ready… set… SLURP!' },
	{ at: 5, speaker: 'Fly', line: 'Whoa! Missed me!' },
	{ at: 7, speaker: 'Frog', line: 'Got you! Chomp, chomp!' },
	{ at: 9.5, speaker: 'Frog', line: 'Wait… flies are not green!' },
	{ at: 11.5, speaker: 'Fly', line: 'That’s a lily pad, silly! Buzz you later!' },
] as const satisfies readonly Beat[];

export const BIG_JUMP_DURATION_SECONDS = 16.5;
export const BIG_JUMP_BEATS = [
	{ at: 0, speaker: 'Lizard', line: 'Fly! I will jump over and get you!' },
	{ at: 3, speaker: 'Lizard', line: 'One… two… um…' },
	{ at: 5.5, speaker: 'Fly', line: 'Three! After two comes three!' },
	{ at: 7.5, speaker: 'Lizard', line: 'Thanks! WHEEE!' },
	{ at: 10, speaker: 'Fly', line: 'Nice hat!' },
	{ at: 12.5, speaker: 'Lizard', line: 'What hat?' },
] as const satisfies readonly Beat[];

export const WEB_GUITAR_DURATION_SECONDS = 17;
export const WEB_GUITAR_BEATS = [
	{ at: 0, speaker: 'Spider', line: 'Shh! I am hiding in my trap.' },
	{ at: 3, speaker: 'Fly', line: 'Hi, Spider! I see eight legs!' },
	{ at: 5.5, speaker: 'Fly', line: 'Ooh! A web guitar!' },
	{ at: 8, speaker: 'Spider', line: 'Hey! Stop! I’m all wiggly!' },
	{ at: 10.5, speaker: 'Fly', line: 'Okay! Just one more!' },
	{ at: 13, speaker: 'Spider', line: 'Wheee! Again! Again!' },
] as const satisfies readonly Beat[];

export const BIG_PLAN_DURATION_SECONDS = 20;
export const BIG_PLAN_BEATS = [
	{ at: 0, speaker: 'Frog', line: 'Team! I have a plan.' },
	{ at: 2.5, speaker: 'Lizard', line: 'We all run to the middle…' },
	{ at: 5, speaker: 'Spider', line: '…and catch the fly!' },
	{ at: 7, speaker: 'Fly', line: 'Ooh! Can I play too?' },
	{ at: 9.5, speaker: 'Together', line: 'Sure! Ready… GO!' },
	{ at: 11.5, speaker: 'Lizard', line: 'Ow! Where did the fly go?' },
	{ at: 13.5, speaker: 'Frog', line: 'Got him! …Lily pad AGAIN?!' },
	{ at: 16, speaker: 'Fly', line: 'Fun game! Buzz you later!' },
] as const satisfies readonly Beat[];

// ---------------------------------------------------------------------------
// Motion helpers
// ---------------------------------------------------------------------------

const clamp = function(value: number): number { return Math.max(0, Math.min(1, value)); };
const progress = function(time: number, start: number, duration: number): number {
	return clamp((time - start) / duration);
};
const ease = function(time: number, start: number, duration: number): number {
	const t = progress(time, start, duration);
	return t * t * (3 - 2 * t);
};
const pose = function(x: number, y: number, tilt = 0, visible = true, facing: 1 | -1 = 1): ScenePose {
	return { x, y, tilt, visible, frame: 0, facing };
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
// Decaying wobble after a pluck/bump; 0 before `start` and under reduced motion.
const wobbleAfter = function(time: number, start: number, amount: number, decay: number, reducedMotion: boolean): number {
	if (reducedMotion || time < start) return 0;
	const since = time - start;
	return Math.sin(since * 13) * amount * Math.exp(-since * decay);
};

// ---------------------------------------------------------------------------
// Skit 1 — Snack Break (after level 3). Bespoke snack-break staging, SkitPresentation shape.
// Fly hovers over a lily pad. Frog's tongue misses the fly (fly pops up) and grabs the pad.
// Frog chews the pad thinking it's the fly, then notices it's green. Fly leaves.
// ---------------------------------------------------------------------------

export const snackBreakPresentation = function(elapsed: number, reducedMotion = false): SkitPresentation {
	const reachStart = 4.4;
	const dodge = clamp((elapsed - 4.8) / 0.45);
	const retract = clamp((elapsed - 5.6) / 0.7);
	const exit = clamp((elapsed - 12.8) / 1.3);
	const reach = clamp((elapsed - reachStart) / 0.4) * (1 - retract);
	const chewing = elapsed >= 7 && elapsed < 9.5;
	// Chomp, chomp: mouth flaps open/shut while chewing (held open under reduced motion).
	const chompOpen = reducedMotion ? true : Math.floor((elapsed - 7) / 0.3) % 2 === 0;
	return {
		flyX: 66 + exit * 46,
		flyY: 55 - dodge * 28 + (reducedMotion ? 0 : Math.sin(elapsed * 5) * 1.2),
		frogTilt: reducedMotion || !chewing ? 0 : Math.sin((elapsed - 7) * Math.PI * 6) * 4,
		tongueReach: reach,
		padX: 66 - retract * 39,
		padY: 63 - retract * 2,
		padCaught: elapsed >= 5.3,
		mouthOpen: (elapsed >= 4.2 && elapsed < 7) || (chewing && chompOpen),
		flyFrame: reducedMotion ? 0 : Math.floor(elapsed * 24) % 8,
		caption: captionAt(SNACK_BREAK_BEATS, elapsed),
	};
};

// ---------------------------------------------------------------------------
// Skit 2 — The Big Jump (after level 6). Layout:
// two gap pads (left/right), floating pad in the middle, splash ring at ~58% x.
// ---------------------------------------------------------------------------

export const bigJumpPresentation = function(time: number, reducedMotion = false): AdditionalSkitPresentation {
	const JUMP = 7.7; const SPLASH = 9.1; const EMERGE = 10.1;
	const jump = progress(time, JUMP, SPLASH - JUMP);
	const emerged = time >= EMERGE;
	const underwater = time >= SPLASH && !emerged;
	const rise = ease(time, EMERGE, 0.8);
	// Rocking back and forth while counting (wind-up), a puzzled lean on "um…".
	const windUp = time >= 3 && time < 5.5 && !reducedMotion ? Math.sin(time * 6) * 4 : 0;
	const puzzled = time >= 4.6 && time < JUMP ? -10 : 0;
	// "What hat?": looks around by rocking left/right (tilt, not facing, because the hat position in skitScreen.ts ignores facing).
	const lookAround = time >= 12.5 ? (reducedMotion ? -8 : Math.sin((time - 12.5) * 4.5) * 12) : 0;
	const lizardY = emerged
		? 95 - rise * 19
		: 73 - (reducedMotion ? 0 : Math.sin(jump * Math.PI) * 22);
	const flyX = 81 - ease(time, 10, 0.8) * 9; // leans in to admire the hat
	return {
		...emptyScene(),
		// Fly bounces with excitement while shouting "Three!"
		fly: flying(time, flyX, 30 - (time >= 5.5 && time < 7.5 && !reducedMotion ? Math.abs(Math.sin(time * 8)) * 5 : 0), reducedMotion, -1),
		lizard: pose(20 + ease(time, JUMP, SPLASH - JUMP) * 38, lizardY, windUp + puzzled + lookAround, !underwater, 1),
		pad: pose(emerged ? 58 : 65, emerged ? 56 : 81, emerged ? -12 : 0),
		hat: emerged,
		splash: underwater,
		burst: underwater ? 'SPLOOSH!' : '',
		caption: captionAt(BIG_JUMP_BEATS, time),
	};
};

// ---------------------------------------------------------------------------
// Skit 3 — The Web Guitar (after level 9). Layout:
// web in the middle, spider in the web, pluck strand on the right side.
// ---------------------------------------------------------------------------

export const webGuitarPresentation = function(time: number, reducedMotion = false): AdditionalSkitPresentation {
	const PLUCK_1 = 5.7; const PLUCK_2 = 11.2;
	const plucking = (time >= PLUCK_1 && time < PLUCK_1 + 1.3) || (time >= PLUCK_2 && time < PLUCK_2 + 1.3);
	const lastPluck = time >= PLUCK_2 ? PLUCK_2 : PLUCK_1;
	const wobble = wobbleAfter(time, lastPluck, 11, 0.7, reducedMotion);
	// Happy bouncing during "Again! Again!"
	const happyHop = time >= 13 && !reducedMotion ? Math.abs(Math.sin((time - 13) * 6)) * 6 : 0;
	const enter = ease(time, 1.8, 1.4);
	return {
		...emptyScene(),
		web: true, webTilt: wobble / 4, webBuild: 0.85 + ease(time, 0, 1.5) * 0.15, pluck: plucking,
		spider: pose(47, 58 + wobble * 0.65 - happyHop, wobble),
		fly: flying(time, 112 - enter * 40, 40 + enter * 15, reducedMotion, -1),
		burst: plucking ? '♪ TWANG! ♪' : '',
		caption: captionAt(WEB_GUITAR_BEATS, time),
	};
};

// ---------------------------------------------------------------------------
// Skit 4 — The Big Plan (after level 12). Layout:
// one big pad along the bottom, plan card ("↓ / → ● ←") in the middle, spider on a thread.
// Fly lands right on the plan's dot while they plan, joins in, zips away at GO.
// ---------------------------------------------------------------------------

export const bigPlanPresentation = function(time: number, reducedMotion = false): AdditionalSkitPresentation {
	const CHARGE = 10.5; const BONK = CHARGE + 0.8; const REBOUND = BONK + 0.2;
	const TONGUE = 13.7; const EXIT = 17.5;
	const charge = ease(time, CHARGE, BONK - CHARGE);
	const rebound = ease(time, REBOUND, 0.9);
	const bonked = time >= BONK && time < BONK + 1.2;
	// Collision shake, then a smaller dizzy wobble through Lizard's line.
	const shake = reducedMotion ? 0
		: bonked ? Math.sin((time - BONK) * 18) * 5 * (1 - rebound)
			: time >= BONK + 1.2 && time < 13.5 ? Math.sin(time * 5) * 3 : 0;
	const landOnDot = ease(time, 3.2, 1.8); // lands on the plan's dot as Spider says "…and catch the fly!"
	const zipAway = ease(time, CHARGE + 0.3, 0.4);
	const leave = ease(time, EXIT, 1.5);
	const flyX = 110 - landOnDot * 60 + zipAway * 20 + leave * 45;
	// Keep the hovering fly's full sprite below the stage ceiling after dodging.
	const flyY = 20 + landOnDot * 50 - zipAway * 43;
	const extend = ease(time, TONGUE, 0.3);
	const catchPad = ease(time, TONGUE + 0.3, 0.8);
	return {
		...emptyScene(),
		diagram: time < CHARGE,
		fly: flying(time, flyX, flyY, reducedMotion, time >= EXIT ? 1 : -1),
		frog: pose(20 + charge * 22 - rebound * 12, 82, -shake),
		spider: pose(50, 43 + charge * 25 - rebound * 20, shake),
		lizard: {
			...pose(80 - charge * 22 + rebound * 14, 82, shake, true, -1),
			frame: reducedMotion || time < CHARGE || time >= BONK ? 0 : Math.floor(time * 12) % 8,
		},
		pad: pose(78 - catchPad * 40, 86 - catchPad * 8, catchPad * -12),
		tongue: extend > 0 && time < TONGUE + 1.3, tongueReach: extend,
		burst: bonked ? 'BONK!' : '',
		caption: captionAt(BIG_PLAN_BEATS, time),
	};
};

// ---------------------------------------------------------------------------
// Registry entries for src/ecs/skitSequence.ts `SKITS`.
// ---------------------------------------------------------------------------

export const SKIT_ENTRIES = [{
	id: 'snack-break', title: 'Snack Break', completedLevel: 3,
	durationSeconds: SNACK_BREAK_DURATION_SECONDS, presentation: snackBreakPresentation,
	stageLabel: 'Frog tries to catch Fly with his tongue. Fly zooms up, and Frog grabs a lily pad instead. Frog chews it and thinks it is Fly, until he sees it is green. Fly says goodbye and flies away.',
}, {
	id: 'the-big-jump', title: 'The Big Jump', completedLevel: 6,
	durationSeconds: BIG_JUMP_DURATION_SECONDS, presentation: bigJumpPresentation,
	stageLabel: 'Lizard counts before a big jump but forgets what comes after two. Fly helps: three! Lizard jumps, splashes into the pond, and pops up wearing a lily pad. He does not know it is on his head.',
}, {
	id: 'the-web-guitar', title: 'The Web Guitar', completedLevel: 9,
	durationSeconds: WEB_GUITAR_DURATION_SECONDS, presentation: webGuitarPresentation,
	stageLabel: 'Spider sits in the middle of her web and says she is hiding. Fly plucks the web like a guitar. Spider wiggles and gets grumpy, then loves it and asks for more.',
}, {
	id: 'the-big-plan', title: 'The Big Plan', completedLevel: 12,
	durationSeconds: BIG_PLAN_DURATION_SECONDS, presentation: bigPlanPresentation,
	stageLabel: 'Frog, Lizard, and Spider plan to meet in the middle and catch Fly. Fly lands right on their plan and asks to play. At GO, Fly zooms away, and the three bonk together. Frog grabs a lily pad again.',
}] as const;

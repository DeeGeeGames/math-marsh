// Scene poses are percentages of the stage. The ECS screen remains the sole clock.
export type ScenePose = { x: number; y: number; tilt: number; visible: boolean };
export type AdditionalSkitPresentation = {
	fly: ScenePose; frog: ScenePose; spider: ScenePose; lizard: ScenePose;
	pad: ScenePose; splash: boolean; web: boolean; webTilt: number; webBuild: number; pluck: boolean;
	diagram: boolean; diagramTilt: number; tongue: boolean; caption: string;
};
const progress = function(time: number, start: number, duration: number): number {
	return Math.max(0, Math.min(1, (time - start) / duration));
};
const pose = function(x: number, y: number, tilt = 0, visible = true): ScenePose {
	return { x, y, tilt, visible };
};
const emptyScene = function(): AdditionalSkitPresentation {
	return {
		fly: pose(75, 25), frog: pose(20, 72, 0, false), spider: pose(50, 50, 0, false),
		lizard: pose(20, 70, 0, false), pad: pose(65, 75, 0, false),
		splash: false, web: false, webTilt: 0, webBuild: 1, pluck: false, diagram: false, diagramTilt: 0, tongue: false, caption: '',
	};
};
export const shortcutPresentation = function(time: number, reducedMotion = false): AdditionalSkitPresentation {
	const crossing = progress(time, 2.3, 1.5);
	const jump = progress(time, 4.4, 1.2);
	const emerged = time >= 6.5;
	return {
		...emptyScene(),
		fly: pose(32 + crossing * 49 + progress(time, 10, 1.5) * 35, 28),
		lizard: pose(20 + jump * 38, emerged ? 76 : 70 - (reducedMotion ? 0 : Math.sin(jump * Math.PI) * 20), reducedMotion ? 0 : -jump * 15, time < 5.6 || emerged),
		pad: pose(emerged ? 58 : 76, emerged ? 56 : 76, emerged ? -12 : 0),
		splash: time >= 5.6 && time < 6.5,
		caption: time < 2.3 ? 'Lizard: “Measure twice. Leap once.”'
			: time < 4.4 ? 'Fly: “Or just fly across.”'
			: time < 5.6 ? 'Lizard: “Here goes!”'
			: time < 6.5 ? 'SPLASH! A little short.'
			: time < 8.7 ? 'Lizard: “I calculated that!”'
			: 'Fly: “Forgot to carry the lizard.”',
	};
};
export const doNotDisturbPresentation = function(time: number, reducedMotion = false): AdditionalSkitPresentation {
	const firstPluck = time >= 3.2 && time < 5.5;
	const secondPluck = time >= 9 && time < 11;
	const reaction = firstPluck || secondPluck;
	const wobble = reaction ? (reducedMotion ? 3 : Math.sin((time - (firstPluck ? 3.2 : 9)) * 19) * 12) : 0;
	return {
		...emptyScene(), web: true, webTilt: wobble / 3, webBuild: progress(time, 0, 1.5), pluck: reaction,
		spider: pose(48, 55 + (reducedMotion ? 0 : wobble * .65), wobble),
		fly: pose(82 - progress(time, 2, 1) * 12 + progress(time, 9.6, 1.6) * 40, reaction ? 47 : 32),
		caption: time < 2 ? 'Spider: “A quiet place to catch dinner.”'
			: time < 3.2 ? 'Fly: “What does this string do?”'
			: time < 5.5 ? 'TWANG! Spider bounces with the web.'
			: time < 7.2 ? 'Spider: “This is a trap!”'
			: time < 9 ? 'Fly: “Sounds like an instrument.”'
			: 'TWANG! One more note, then Fly leaves.',
	};
};
export const dinnerCommitteePresentation = function(time: number, reducedMotion = false): AdditionalSkitPresentation {
	const rotation = progress(time, 3.2, .8);
	const charge = progress(time, 4.8, 1.1);
	const collided = time >= 5.9;
	const catchPad = progress(time, 7, .8);
	const shake = collided && time < 6.7 && !reducedMotion ? Math.sin(time * 25) * 7 : 0;
	return {
		...emptyScene(), diagram: true, diagramTilt: rotation * 180,
		fly: pose(65 + progress(time, 8.8, 2) * 48, time >= 3.2 && time < 4.8 ? 38 : 23),
		frog: pose(22 + charge * 20, 77, collided ? -18 + shake : 0),
		spider: pose(50, 40 + charge * 28, collided ? 20 - shake : 0),
		lizard: pose(78 - charge * 20, 77, collided ? 25 + shake : 0),
		pad: pose(78 - catchPad * 37, 84 - catchPad * 21, catchPad * -25),
		tongue: time >= 7 && time < 7.8,
		caption: time < 1.8 ? 'Frog: “Team meeting. Who gets dinner?”'
			: time < 3.2 ? 'Spider: “I block!” Lizard: “I chase!”'
			: time < 4.8 ? 'Fly turns their plan around…'
			: time < 5.9 ? 'All three: “CHARGE!”'
			: time < 7 ? 'BONK! Everyone meets in the middle.'
			: time < 8.2 ? 'Frog reels in a lily pad.'
			: time < 9.6 ? 'Frog: “Salad. Again.”'
			: 'Fly: “Three predators. Zero coordination.”',
	};
};

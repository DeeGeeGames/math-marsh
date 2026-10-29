/** Presentation-only attract scene. It never reads or writes learner progress. */
type Point = Readonly<{ x: number; y: number }>;
type Direction = 'left' | 'right';
type Phase = 'idle' | 'turn' | 'move' | 'eat' | 'solved';
export type TitlePose = Readonly<Point & {
	sheet: 'front' | 'side' | 'turn' | 'eat'; frame: number; flip: boolean;
}>;
type Step = Readonly<{
	phase: Phase; duration: number; from: Point; to: Point;
	direction: Direction; reverse: boolean;
}>;
const step = function(phase: Phase, duration: number, from: Point, to = from,
	direction: Direction = 'right', reverse = false): Step {
	return { phase, duration, from, to, direction, reverse };
};
const smooth = function(t: number): number { return t * t * (3 - 2 * t); };
const durationOf = function(steps: readonly Step[]): number {
	return steps.reduce(function(sum, item) { return sum + item.duration; }, 0);
};
const locate = function<T extends Step>(steps: readonly T[], time: number): Readonly<{ step: T; progress: number }> {
	const duration = durationOf(steps);
	let remaining = ((time % duration) + duration) % duration;
	for (const item of steps) {
		if (remaining < item.duration) return { step: item, progress: remaining / item.duration };
		remaining -= item.duration;
	}
	throw new Error('Title sequence has no active step');
};
const poseFor = function(item: Step, progress: number, animal: 'frog' | 'lizard' | 'fly'): TitlePose {
	let travel = smooth(progress);
	if (animal === 'frog' && item.phase === 'move') {
		const hops = progress * 4;
		travel = (Math.floor(hops) + 1 - (1 - hops % 1) ** 2) / 4;
	}
	const moving = item.phase === 'move';
	const x = moving ? item.from.x + (item.to.x - item.from.x) * travel : item.from.x;
	const y = moving ? item.from.y + (item.to.y - item.from.y) * travel : item.from.y;
	const elapsed = progress * item.duration;
	if (item.phase === 'turn') {
		const frame = Math.min(7, Math.floor(progress * 8));
		return { x, y, sheet: 'turn', flip: item.direction === 'left', frame: item.reverse ? 7 - frame : frame };
	}
	if (moving) return { x, y, sheet: 'side', flip: item.direction === 'left',
		frame: Math.floor(progress * (animal === 'frog' ? 32 : animal === 'fly' ? 32 : 24)) % 8 };
	if (item.phase === 'eat') return { x, y, sheet: 'eat', flip: false, frame: Math.min(7, Math.floor(progress * 8)) };
	return { x, y, sheet: 'front', flip: false, frame: animal === 'fly' ? Math.floor(elapsed * 16) % 8 : 7 };
};
const patrol = function(from: Point, to: Point, wait: number, travel: number, rest: number): readonly Step[] {
	const direction = to.x < from.x ? 'left' : 'right';
	const back = direction === 'left' ? 'right' : 'left';
	return [step('idle', wait, from), step('turn', .44, from, from, direction),
		step('move', travel, from, to, direction), step('turn', .44, to, to, direction, true),
		step('idle', rest, to), step('turn', .44, to, to, back),
		step('move', travel, to, from, back), step('turn', .44, from, from, back, true), step('idle', 4.8, from)];
};
const frogSteps = patrol({ x: 80, y: 70 }, { x: 69, y: 70 }, 2.8, 2.4, 4);
const lizardSteps = patrol({ x: 43, y: 72 }, { x: 53, y: 72 }, 5.4, 3, 3.6);
export const titlePatrolPose = function(animal: 'frog' | 'lizard', time: number): TitlePose {
	const active = locate(animal === 'frog' ? frogSteps : lizardSteps, time);
	return poseFor(active.step, active.progress, animal);
};
const PADS: readonly Point[] = [{ x: 0, y: 0 }, { x: .5, y: -1 }, { x: 1, y: 0 }];
const padAt = function(index: number): Point {
	const pad = PADS[index];
	if (!pad) throw new Error('Invalid title pad');
	return pad;
};
export const TITLE_PROBLEMS = [
	{ expression: '6 + 2', answer: 8, distractors: [6, 2] },
	{ expression: '9 − 5', answer: 4, distractors: [3, 7] },
	{ expression: '3 × 2', answer: 6, distractors: [5, 9] },
	{ expression: '12 ÷ 3', answer: 4, distractors: [3, 6] },
	{ expression: '5 + 5', answer: 10, distractors: [8, 11] },
	{ expression: '10 − 3', answer: 7, distractors: [6, 9] },
] as const;
type DemoStep = Step & Readonly<{
	expression: string; answer: number; values: readonly number[]; target: number; pad: number;
}>;
const buildDemo = function(): readonly DemoStep[] {
	const steps: DemoStep[] = [];
	let current = 0;
	for (const problem of TITLE_PROBLEMS) {
		const target = (current + 2) % 3;
		const wrong = (current + 1) % 3;
		const values = PADS.map(function(_, index): number {
			if (index === target) return problem.answer;
			const value = problem.distractors[index < target ? index : index - 1];
			if (value === undefined) throw new Error('Missing title distractor');
			return value;
		});
		const add = function(item: Step): void {
			steps.push({ ...item, expression: problem.expression, answer: problem.answer, values, target, pad: current });
		};
		add(step('idle', 1.8, padAt(current)));
		for (const destination of [wrong, target]) {
			const from = padAt(current), to = padAt(destination);
			const direction = to.x < from.x ? 'left' : 'right';
			add(step('turn', .44, from, from, direction));
			add(step('move', 2.2, from, to, direction));
			current = destination;
			add(step('turn', .44, to, to, direction, true));
			add(step('idle', destination === target ? .6 : 1.5, to));
		}
		add(step('eat', 1.1, padAt(current)));
		add(step('solved', 2.4, padAt(current)));
	}
	return steps;
};
const demoSteps = buildDemo();
export const TITLE_DEMO_DURATION = durationOf(demoSteps);
export const titleDemoState = function(time: number): Readonly<{
	pose: TitlePose; expression: string; answer: number; values: readonly number[];
	target: number; pad: number; phase: Phase; consumed: boolean; bite: number;
}> {
	const { step: item, progress } = locate(demoSteps, time);
	return { pose: poseFor(item, progress, 'fly'), expression: item.expression,
		answer: item.answer, values: item.values, target: item.target, pad: item.pad, phase: item.phase,
		consumed: item.phase === 'solved' || item.phase === 'eat' && progress >= .72,
		bite: item.phase === 'solved' ? 1 : item.phase === 'eat' ? Math.max(0, Math.min(1, (progress - .18) / .54)) : 0 };
};
export const titleSpiderPose = function(time: number): Readonly<{ y: number; visible: boolean; frame: number }> {
	const phase = ((time % 25) + 25) % 25;
	if (phase < 4.5 || phase >= 10.9) return { y: -22, visible: false, frame: 7 };
	if (phase < 6.1) {
		const p = (phase - 4.5) / 1.6;
		return { y: -22 + 31 * (1 - (1 - p) ** 3), visible: true, frame: Math.floor(p * 16) % 8 };
	}
	if (phase < 9.1) return { y: 9, visible: true, frame: 7 };
	const p = (phase - 9.1) / 1.8;
	return { y: 9 - 31 * p * p, visible: true, frame: 7 - Math.floor(p * 16) % 8 };
};

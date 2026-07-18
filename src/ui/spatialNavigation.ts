export type FocusDirection = 'up' | 'down' | 'left' | 'right';

export type SpatialRect = Readonly<{
	left: number;
	right: number;
	top: number;
	bottom: number;
}>;

type Point = Readonly<{
	x: number;
	y: number;
}>;

const center = function center(rect: SpatialRect): Point {
	return {
		x: (rect.left + rect.right) / 2,
		y: (rect.top + rect.bottom) / 2,
	};
};

type NavigationAxis = Readonly<{
	forward: keyof Point;
	cross: keyof Point;
	sign: -1 | 1;
}>;

const navigationAxis: Record<FocusDirection, NavigationAxis> = {
	up: { forward: 'y', cross: 'x', sign: -1 },
	down: { forward: 'y', cross: 'x', sign: 1 },
	left: { forward: 'x', cross: 'y', sign: -1 },
	right: { forward: 'x', cross: 'y', sign: 1 },
};

type ScoredIndex = Readonly<{
	index: number;
	score: number;
}>;

const DIRECTION_EPSILON_PX = 4;

function scoreCandidate(
	current: Point,
	candidate: Point,
	direction: FocusDirection,
	index: number,
): ScoredIndex | null {
	const axis = navigationAxis[direction];
	const forwardDistance = (candidate[axis.forward] - current[axis.forward]) * axis.sign;
	if (forwardDistance <= DIRECTION_EPSILON_PX) return null;

	const crossDistance = Math.abs(candidate[axis.cross] - current[axis.cross]);
	return {
		index,
		score: forwardDistance * forwardDistance + 4 * crossDistance * crossDistance,
	};
}

export function findSpatialTargetIndex(
	rects: readonly SpatialRect[],
	currentIndex: number,
	direction: FocusDirection,
): number | null {
	const currentRect = rects[currentIndex];
	if (!currentRect) return rects.length > 0 ? 0 : null;
	const currentCenter = center(currentRect);

	return rects
		.map((rect, index) => {
			if (index === currentIndex) return null;
			return scoreCandidate(currentCenter, center(rect), direction, index);
		})
		.filter((candidate): candidate is ScoredIndex => candidate !== null)
		.reduce<ScoredIndex | null>((best, candidate) => {
			if (!best || candidate.score < best.score) return candidate;
			return best;
		}, null)?.index ?? null;
}

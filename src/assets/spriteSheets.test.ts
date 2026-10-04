import { describe, expect, test } from 'bun:test';

type SpriteSheetSpec = {
	path: URL;
	frameCount: number;
};

type PngDimensions = {
	width: number;
	height: number;
};

const EIGHT_FRAME_SHEETS = [
	'images/fly-eat-away.png',
	'images/fly-eat-side.png',
	'images/fly-eat-toward.png',
	'images/fly-move-away.png',
	'images/fly-move-side.png',
	'images/fly-move-toward.png',
	'images/fly-turn-toward-side.png',
	'images/fly-turn-side-away.png',
	'images/frog-hop-away.png',
	'images/frog-hop-side.png',
	'images/frog-hop-toward.png',
	'images/frog-turn-front-side.png',
	'images/frog-turn-side-away.png',
	'lizard-walk-away.png',
	'lizard-walk-side.png',
	'lizard-walk-toward.png',
	'lizard-turn-side-away.png',
	'lizard-turn-toward-side.png',
	'spider-walk-away.png',
	'spider-walk-side.png',
	'spider-walk-toward.png',
	'spider-turn-side-away.png',
	'spider-turn-toward-side.png',
] as const;

const FOUR_FRAME_SHEETS = [
	'images/frog-mouth-open-back.png',
	'images/frog-open-mouth-side.png',
	'images/frog-mouth-open-front.png',
] as const;

const spriteSheetSpecs = [
	...EIGHT_FRAME_SHEETS.map(path => ({ path: new URL(path, import.meta.url), frameCount: 8 })),
	...FOUR_FRAME_SHEETS.map(path => ({ path: new URL(path, import.meta.url), frameCount: 4 })),
] as const satisfies readonly SpriteSheetSpec[];

const readPngDimensions = async function readPngDimensions(path: URL): Promise<PngDimensions> {
	const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
	const pngSignature = [0x89, 0x50, 0x4e, 0x47] as const;
	const hasPngSignature = pngSignature.every((byte, index) => bytes[index] === byte);

	if (!hasPngSignature) {
		throw new Error(`${path.pathname} is not a PNG file`);
	}

	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

	return {
		width: view.getUint32(16),
		height: view.getUint32(20),
	};
};

describe('sprite sheets', () => {
	test('use square horizontal frame slots matching runtime frame counts', async () => {
		const dimensions = await Promise.all(
			spriteSheetSpecs.map(async spec => ({
				...spec,
				dimensions: await readPngDimensions(spec.path),
			})),
		);
		const sheetGeometry = dimensions.map(({ path, frameCount, dimensions: { width, height } }) => ({
			path: path.pathname.split('/').slice(-2).join('/'),
			frameWidth: width / frameCount,
			height,
			isDivisible: width % frameCount === 0,
		}));

		expect(sheetGeometry).toEqual(
			sheetGeometry.map(({ path, height }) => ({
				path,
				frameWidth: height,
				height,
				isDivisible: true,
			})),
		);
	});
});

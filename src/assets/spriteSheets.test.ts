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
	'sprites/fly/fly-eat-side.png',
	'sprites/fly/fly-eat-toward.png',
	'sprites/fly/fly-move-away.png',
	'sprites/fly/fly-move-side.png',
	'sprites/fly/fly-move-toward.png',
	'sprites/fly/fly-turn-toward-side.png',
	'sprites/fly/fly-turn-side-away.png',
	'sprites/frog/frog-hop-away.png',
	'sprites/frog/frog-hop-side.png',
	'sprites/frog/frog-hop-toward.png',
	'sprites/frog/frog-turn-front-side.png',
	'sprites/frog/frog-turn-side-away.png',
	'sprites/lizard/lizard-walk-away.png',
	'sprites/lizard/lizard-walk-side.png',
	'sprites/lizard/lizard-walk-toward.png',
	'sprites/lizard/lizard-turn-side-away.png',
	'sprites/lizard/lizard-turn-toward-side.png',
	'sprites/spider/spider-walk-away.png',
	'sprites/spider/spider-walk-side.png',
	'sprites/spider/spider-walk-toward.png',
	'sprites/spider/spider-turn-side-away.png',
	'sprites/spider/spider-turn-toward-side.png',
] as const;

const FOUR_FRAME_SHEETS = [
	'sprites/frog/frog-mouth-open-back.png',
	'sprites/frog/frog-open-mouth-side.png',
	'sprites/frog/frog-mouth-open-front.png',
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

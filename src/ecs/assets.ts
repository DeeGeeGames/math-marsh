import type { AssetConfiguratorFn, AssetDefinition } from 'ecspresso';
import flyEatAway from '../assets/images/fly-eat-away.png';
import flyEatSide from '../assets/images/fly-eat-side.png';
import flyEatToward from '../assets/images/fly-eat-toward.png';
import flyMoveAway from '../assets/images/fly-move-away.png';
import flyMoveSide from '../assets/images/fly-move-side.png';
import flyMoveToward from '../assets/images/fly-move-toward.png';
import flyTurnTowardSide from '../assets/images/fly-turn-toward-side.png';
import flyTurnSideAway from '../assets/images/fly-turn-side-away.png';
import frogImage from '../assets/images/frog.svg';
import spiderImage from '../assets/images/spider.png';
import lizardWalkAway from '../assets/lizard-walk-away.png';
import lizardWalkSide from '../assets/lizard-walk-side.png';
import lizardWalkToward from '../assets/lizard-walk-toward.png';
import lizardTurnSideAway from '../assets/lizard-turn-side-away.png';
import lizardTurnTowardSide from '../assets/lizard-turn-toward-side.png';
import spiderWalkAway from '../assets/spider-walk-away.png';
import spiderWalkSide from '../assets/spider-walk-side.png';
import spiderWalkToward from '../assets/spider-walk-toward.png';
import spiderTurnSideAway from '../assets/spider-turn-side-away.png';
import spiderTurnTowardSide from '../assets/spider-turn-toward-side.png';
import frogHopAway from '../assets/images/frog-hop-away.png';
import frogHopSide from '../assets/images/frog-hop-side.png';
import frogHopToward from '../assets/images/frog-hop-toward.png';
import frogMouthOpenAway from '../assets/images/frog-mouth-open-back.png';
import frogMouthOpenSide from '../assets/images/frog-open-mouth-side.png';
import frogMouthOpenToward from '../assets/images/frog-mouth-open-front.png';
import frogTurnFrontSide from '../assets/images/frog-turn-front-side.png';
import frogTurnSideAway from '../assets/images/frog-turn-side-away.png';

export {
  flyEatAway,
  flyEatSide,
  flyEatToward,
  flyTurnTowardSide,
  flyTurnSideAway,
  flyMoveAway,
  flyMoveSide,
  flyMoveToward,
  frogImage,
  spiderImage,
  lizardWalkAway,
  lizardWalkSide,
  lizardWalkToward,
  lizardTurnSideAway,
  lizardTurnTowardSide,
  spiderWalkAway,
  spiderWalkSide,
  spiderWalkToward,
  spiderTurnSideAway,
  spiderTurnTowardSide,
  frogHopAway,
  frogHopSide,
  frogHopToward,
  frogMouthOpenAway,
  frogMouthOpenSide,
  frogMouthOpenToward,
  frogTurnFrontSide,
  frogTurnSideAway,
};

const ENTITY_IMAGE_GROUP = 'entityImages';

const IMAGE_ASSETS = {
  flyEatAway,
  flyEatSide,
  flyEatToward,
  flyTurnTowardSide,
  flyTurnSideAway,
  flyMoveAway,
  flyMoveSide,
  flyMoveToward,
  frogImage,
  spiderImage,
  lizardWalkAway,
  lizardWalkSide,
  lizardWalkToward,
  lizardTurnSideAway,
  lizardTurnTowardSide,
  spiderWalkAway,
  spiderWalkSide,
  spiderWalkToward,
  spiderTurnSideAway,
  spiderTurnTowardSide,
  frogHopAway,
  frogHopSide,
  frogHopToward,
  frogMouthOpenAway,
  frogMouthOpenSide,
  frogMouthOpenToward,
  frogTurnFrontSide,
  frogTurnSideAway,
} as const;

export type ImageAssetKey = keyof typeof IMAGE_ASSETS;
type ConfiguredImageAssets = Record<ImageAssetKey, HTMLImageElement>;
type ImageAssetConfigurator = AssetConfiguratorFn<ConfiguredImageAssets, typeof ENTITY_IMAGE_GROUP>;

export const IMAGE_ASSET_KEYS = Object.keys(IMAGE_ASSETS) as ImageAssetKey[];

const IMAGE_SRC_TO_KEY = new Map<string, ImageAssetKey>(
  Object.entries(IMAGE_ASSETS).map(([key, src]) => [src, key as ImageAssetKey]),
);

export function imageAssetKeyFromSrc(src: string): ImageAssetKey | undefined {
  return IMAGE_SRC_TO_KEY.get(src);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = (): void => { resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

const imageAsset = (src: string): AssetDefinition<HTMLImageElement> => ({
  loader: () => loadImage(src),
  eager: true,
  group: ENTITY_IMAGE_GROUP,
});

export const configureImageAssets: ImageAssetConfigurator = function configureImageAssets(assets) {
  return assets
    .addWithConfig('flyEatAway', imageAsset(flyEatAway))
    .addWithConfig('flyEatSide', imageAsset(flyEatSide))
    .addWithConfig('flyEatToward', imageAsset(flyEatToward))
    .addWithConfig('flyMoveAway', imageAsset(flyMoveAway))
    .addWithConfig('flyMoveSide', imageAsset(flyMoveSide))
    .addWithConfig('flyMoveToward', imageAsset(flyMoveToward))
    .addWithConfig('flyTurnTowardSide', imageAsset(flyTurnTowardSide))
    .addWithConfig('flyTurnSideAway', imageAsset(flyTurnSideAway))
    .addWithConfig('frogImage', imageAsset(frogImage))
    .addWithConfig('spiderImage', imageAsset(spiderImage))
    .addWithConfig('lizardWalkAway', imageAsset(lizardWalkAway))
    .addWithConfig('lizardWalkSide', imageAsset(lizardWalkSide))
    .addWithConfig('lizardWalkToward', imageAsset(lizardWalkToward))
    .addWithConfig('lizardTurnSideAway', imageAsset(lizardTurnSideAway))
    .addWithConfig('lizardTurnTowardSide', imageAsset(lizardTurnTowardSide))
    .addWithConfig('spiderWalkAway', imageAsset(spiderWalkAway))
    .addWithConfig('spiderWalkSide', imageAsset(spiderWalkSide))
    .addWithConfig('spiderWalkToward', imageAsset(spiderWalkToward))
    .addWithConfig('spiderTurnSideAway', imageAsset(spiderTurnSideAway))
    .addWithConfig('spiderTurnTowardSide', imageAsset(spiderTurnTowardSide))
    .addWithConfig('frogHopAway', imageAsset(frogHopAway))
    .addWithConfig('frogHopSide', imageAsset(frogHopSide))
    .addWithConfig('frogHopToward', imageAsset(frogHopToward))
    .addWithConfig('frogMouthOpenAway', imageAsset(frogMouthOpenAway))
    .addWithConfig('frogMouthOpenSide', imageAsset(frogMouthOpenSide))
    .addWithConfig('frogMouthOpenToward', imageAsset(frogMouthOpenToward))
    .addWithConfig('frogTurnFrontSide', imageAsset(frogTurnFrontSide))
    .addWithConfig('frogTurnSideAway', imageAsset(frogTurnSideAway));
};

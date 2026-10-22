import type { GameEngine } from '../ecs/Engine';
import type { Resources } from '../ecs/types';
import type { SoundEffect } from '../audio/audio';

export type ActionSound = (sound: SoundEffect) => void;
// Resource writes return no fluent engine, allowing small worlds and test dependencies.
// Overloads preserve each resource key/value pairing without coupling engine registries.
type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void ? I : never;
export type ResourceActions = {
  getResource: <K extends keyof Resources>(key: K) => Resources[K];
  setResource: UnionToIntersection<{ [K in keyof Resources]: (key: K, value: Resources[K]) => void }[keyof Resources]>;
};
export type ScreenActions = Pick<GameEngine, 'getCurrentScreen' | 'setScreen' | 'pushScreen' | 'popScreen' | 'getScreenState' | 'updateScreenState'>;

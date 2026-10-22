import type { ProfileStorage } from '../profiles/persistence';

export const browserProfileStorage = function(): ProfileStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.mathMarshDesktop?.profileStorage ?? window.localStorage;
  } catch {
    return undefined;
  }
};

export const createPlayerProfileId = function(): string {
  try {
    const cryptoApi = globalThis.crypto;
    if (typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  } catch {
    // Fall through to the local generator when platform crypto is unavailable.
  }
  return `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};


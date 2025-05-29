import { merge } from 'ts-deepmerge';
import type { PersistStorage, StateStorage } from 'zustand/middleware';

export function makeSerdeStorage<T, U = any>(
  getStorage: () => StateStorage,
  serialize: (state: T) => Promise<U>,
  deserialize: (input: U) => Promise<Partial<T>>
): PersistStorage<T> {
  const storage = getStorage();
  return {
    async getItem(name) {
      const json = await Promise.resolve(storage.getItem(name))
      if (!json)
        return null;

      let { version, state } = JSON.parse(json);
      return {
        version,
        state: merge(state, await deserialize(state)) as T
      }
    },

    async setItem(name, input) {
      let state  = await serialize(input.state)
      const json = JSON.stringify({ version: input.version, state })

      storage.setItem(name, json)
    },

    removeItem(name) {
      storage.removeItem(name)
    }
  };
}

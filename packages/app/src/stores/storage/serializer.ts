import { merge } from "ts-deepmerge";
import type { PersistStorage, StateStorage } from "zustand/middleware";

export function makeSerializerStorage<T, U = T>(
  storage: StateStorage,
  serialize: (state: T) => Promise<U>,
  deserialize: (input: U) => Promise<Partial<T>>,
): PersistStorage<T> {
  return {
    async getItem(name) {
      const json = await Promise.resolve(storage.getItem(name));
      if (!json) return null;

      const { version, state } = JSON.parse(json);
      return {
        version,
        state: merge(state, await deserialize(state)) as T,
      };
    },

    async setItem(name, input) {
      const state = await serialize(input.state);
      const json = JSON.stringify({ version: input.version, state });

      storage.setItem(name, json);
    },

    removeItem(name) {
      storage.removeItem(name);
    },
  };
}

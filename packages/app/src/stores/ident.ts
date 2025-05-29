import { merge } from 'ts-deepmerge'
import { create, type StateCreator } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

import { makeSerdeStorage } from './serde-storage';
import { generateKeypair, exportKeypair, importKeypair } from './ident-keys';
import type { JsonWebKeyPair } from './types';
import { generateIdentId } from './ident-id';

export type Slice = {
  ensure: () => Promise<Required<Slice>>,

  id?: string,
  jwks?: JsonWebKeyPair,
  keypair?: CryptoKeyPair,
}

const stateStorage = makeSerdeStorage(
  () => localStorage,

  // jwks <-> cryptokeys
  // jwk is serializable

  async function serialize(state: Slice): Promise<Omit<Slice, 'keypair'>> {
    const { keypair, ...rest } = state;
    return rest;
  },

  async function deserialize(state) {
    return { ...state, keypair: await importKeypair(state.jwks) };
  }
)

const stateCreator: StateCreator<Slice> = (set, get) => ({
  keypair: undefined,
  jwks:    undefined,

  ensure: async () => {
    const self = get();

    let keypair = self.keypair
    if (!keypair) {
      const id      = generateIdentId()
      const keypair = await generateKeypair()
      const jwks    = await exportKeypair(keypair)

      set({ ...self, id, keypair, jwks })
    }

    return get() as Required<Slice>
  }
})

export const useIdentStore = create<Slice>()(
  devtools(
    persist(stateCreator,
      {
        name: 'skypod-identity',
        storage: stateStorage,
        merge(persistedState, currentState) {
          return merge(currentState, persistedState as any) as unknown as Slice;
        },
      }
    )
  )
);

import { merge } from 'ts-deepmerge';
import { create, type StateCreator } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { generateIdentId, type IdentId } from './ident-id';
import { exportKeypair, fingerprintPublicKey, generateKeypair, importKeypair } from './ident-keys';
import { makeSerdeStorage } from './serde-storage';
import { createPrivateLocalStorage } from './private-storage';
import type { JsonWebKeyPair } from './types';

export type IdentityState = {
  id?: IdentId,

  jwks?: JsonWebKeyPair,
  keypair?: CryptoKeyPair,
  fingerprint?: string,

  ensure: () => Promise<Required<IdentityState>>,
}

export type SerializedIdentity =
  Omit<IdentityState, 'keypair'>

// custom serializer, so that we can store the jwks

const stateStorage = makeSerdeStorage(
  () => createPrivateLocalStorage<SerializedIdentity>(['jwks']),

  // ignore keypair on flush, reload on read

  async function serialize(state: IdentityState): Promise<SerializedIdentity> {
    const { keypair, ...rest } = state;
    return rest;
  },

  async function deserialize(state) {
    return { ...state, keypair: await importKeypair(state.jwks) };
  }
)

const stateCreator: StateCreator<IdentityState> = (set, get) => ({
  id: undefined,
  jwks: undefined,
  keypair: undefined,
  fingerprint: undefined,

  ensure: async () => {
    const self = get();
    if (!self.id) {
      const id          = generateIdentId()
      const keypair     = await generateKeypair()
      const jwks        = await exportKeypair(keypair)
      const fingerprint = await fingerprintPublicKey(keypair)

      set({ ...self, id, jwks, keypair, fingerprint })
    }

    return get() as Required<IdentityState>
  }
})

export const useIdentStore = create<IdentityState>()(
  devtools(
    persist(stateCreator,
      {
        name: 'skypod-identity',
        storage: stateStorage,
        merge(persistedState, currentState) {
          return merge(currentState, persistedState as any) as unknown as IdentityState;
        },
      }
    ),
    { name: 'ident-store' }
  )
);

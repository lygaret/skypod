import { merge } from 'ts-deepmerge';
import { create, type StateCreator } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { generateIdentId, type IdentId } from './ident-id';
import { exportKeypair, fingerprintPublicKey, generateKeypair, importKeypair } from './ident-keys';
import { makeSerdeStorage } from './serde-storage';
import { makePrivateBoundStorage } from './private-bound-storage';
import type { JsonWebKeyPair } from './types';

export interface IdentityState {
  id?: IdentId,

  jwks?: JsonWebKeyPair,
  keypair?: CryptoKeyPair,
  fingerprint?: string,

  ensure: () => Promise<Required<IdentityState>>,
}

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

// custom serializer, so that we can store the jwks
type SerializedIdentity = Omit<IdentityState, 'keypair'>

export const useIdentStore = create<IdentityState>()(
  devtools(
    persist(
      stateCreator,
      {
        // persist options
        name: 'skypod-identity',

        // we encrypt in localstorage, with a browser-bound encryption
        storage: makeSerdeStorage(
          makePrivateBoundStorage(localStorage),

          // since the keypair isn't serializable, but jwk is
          // ignore keypair on flush, reload on read

          async function serialize(state: IdentityState): Promise<SerializedIdentity> {
            const { keypair, ...rest } = state;
            return rest;
          },

          async function deserialize(state) {
            return { ...state, keypair: await importKeypair(state.jwks) };
          }
        ),

        // deep merge
        merge(persistedState, currentState) {
          return merge(currentState, persistedState as any) as unknown as IdentityState;
        },
      }
    ),
    {
      // devtools options
      name: 'ident-store'
    }
  )
);

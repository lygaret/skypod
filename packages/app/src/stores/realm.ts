import { merge } from 'ts-deepmerge'
import { create, type StateCreator } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'

import { useIdentStore } from './ident'
import { type IdentId } from './ident-id'
import { generateRealmId, type RealmId } from './realm-id'
import { makePrivateBoundStorage } from './private-bound-storage'

export interface PeerKey {
  jwk: JsonWebKey,
  fingerprint: string
}

export interface RealmState {
  id?: RealmId,
  peers: Record<IdentId, PeerKey>,

  create: () => Promise<void>,
  join: (invite: unknown) => Promise<void>,
}

const stateCreator: StateCreator<RealmState> = (set) => ({
  id: undefined,
  peers: {},

  create: async () => {
    const realmId = generateRealmId();
    const ident   = await useIdentStore.getState().ensure()
    const peers   = {
      [ident.id]: { jwk: ident.jwks.publicKey, fingerprint: ident.fingerprint }
    };

    // todo: this should save this to the server
    // todo: if the server fails, we can still create a realm, but it won't be signallable; what should we do?

    set({ id: realmId, peers })
  },

  join: async (_invite: unknown) => {
    // todo
  }
});

export const useRealmStore = create<RealmState>()(
  devtools(
    persist(
      stateCreator,
      {
        // persist options
        name: 'skypod-realm',

        // we encrypt in localstorage, with a browser-bound encryption
        storage: createJSONStorage(() => makePrivateBoundStorage(localStorage)),

        merge(persistedState, currentState) {
          return merge(currentState, persistedState as any) as unknown as RealmState;
        },
    }),
    {
      // dev-tools options
      name: 'realm-store'
    }
  )
);

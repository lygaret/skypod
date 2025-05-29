import { merge } from 'ts-deepmerge'
import { create, type StateCreator } from 'zustand'
import { devtools, persist, createJSONStorage } from 'zustand/middleware'

import { generateRealmId, type RealmId } from './realm-id'
import { useIdentStore } from './ident'
import type { IdentId } from './ident-id'
import { createPrivateLocalStorage } from './private-storage'

export type PeerKey = {
  jwk: JsonWebKey,
  fingerprint: string
}

export type Slice = {
  id?: RealmId,
  peers: Record<IdentId, PeerKey>,

  create: () => Promise<void>,
  join: (invite: unknown) => Promise<void>,
}

const stateCreator: StateCreator<Slice> = (set) => ({
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

export const useRealmStore = create<Slice>()(
  devtools(
    persist(stateCreator, {
      name: 'skypod-realm',
      storage: createJSONStorage(() => createPrivateLocalStorage<Slice>(['peers'])),
      merge(persistedState, currentState) {
        return merge(currentState, persistedState as any) as unknown as Slice;
      },
    }),
    { name: 'realm-store' }
  )
);

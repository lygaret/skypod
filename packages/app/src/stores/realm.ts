import { merge } from 'ts-deepmerge'
import { create, type StateCreator } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { generateRealmId } from './realm-id'
import { useIdentStore } from './ident'

export type Slice = {
  id?: string,
  peers: Record<string, JsonWebKey>,

  create: () => Promise<void>,
  join: (invite: unknown) => Promise<void>,
}

const stateCreator: StateCreator<Slice> = (set) => ({
  id: undefined,
  peers: {},

  create: async () => {
    const realmId = generateRealmId();
    const ident   = await useIdentStore.getState().ensure()
    const peers   = { [ident.id]: ident.jwks.publicKey }

    // todo: this should hit the server with a uuid and my public key
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
      merge(persistedState, currentState) {
        return merge(currentState, persistedState as any) as unknown as Slice;
      },
    })
  )
);

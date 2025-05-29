import { merge } from 'ts-deepmerge'
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export type Slice = {
  id?: string,
  email?: string,
  peers: string[],

  enrolled: () => boolean,
  create: () => Promise<void>,
  invite: () => Promise<unknown>,
  join: (invite: unknown) => Promise<void>,
}

export const useRealmStore = create<Slice>()(
  devtools(
    persist(
      (_set, get) => ({
        id:    undefined,
        email: undefined,
        peers: [],

        enrolled: () => {
          return get().id != undefined;
        },

        create: async () => {
          // todo
        },

        invite: async () => {
          // todo
        },

        join: async (_invite: unknown) => {
          // todo
        }
      }),
      {
        name: 'skypod-realm',
        merge(persistedState, currentState) {
          return merge(currentState, persistedState as any) as unknown as Slice;
        },
      }
    )
  )
);

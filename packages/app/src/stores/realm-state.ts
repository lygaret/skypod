import { type StateCreator } from "zustand";

import type { IdentId } from "./ident-id";
import { generateRealmId, type RealmId } from "./realm-id";
import { useIdentStore } from ".";

export interface PeerKey {
  jwk: JsonWebKey;
  thumb: string;
}

export interface RealmState {
  id?: RealmId;
  peers: Record<IdentId, PeerKey>;

  create: () => Promise<void>;
  join: (invite: unknown) => Promise<void>;
}

export const realmStateCreator: StateCreator<
  RealmState,
  [["zustand/devtools", never], ["zustand/persist", unknown]],
  [],
  RealmState
> = (set) => ({
  id: undefined,
  peers: {},

  create: async () => {
    const realmId = generateRealmId();
    const ident = await useIdentStore.getState().ensure();
    const peers = {
      [ident.id]: { jwk: ident.jwks.publicKey, thumb: ident.thumb },
    };

    // todo: this should save this to the server
    // todo: if the server fails, we can still create a realm, but it won't be signallable; what should we do?

    set({ id: realmId, peers }, undefined, "realm/create");
  },

  join: async (_invite: unknown) => {
    // todo
  },
});

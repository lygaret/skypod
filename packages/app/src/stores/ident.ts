import { merge } from "ts-deepmerge";
import { create, type StateCreator } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { generateIdentId } from "./ident-id";
import {
  exportKeypair,
  fingerprintPublicKey,
  generateKeypair,
  importKeypair,
} from "./ident-keys";
import { type IdentityState } from "./ident-state";
import { makeSerdeStorage } from "./storage-serde";
import { makePrivateBoundStorage } from "./storage-private-bound";

const stateCreator: StateCreator<IdentityState> = (set, get) => ({
  id: undefined,
  jwks: undefined,
  keypair: undefined,
  fingerprint: undefined,

  ensure: async () => {
    const self = get();
    if (!self.id) {
      const id = generateIdentId();
      const keypair = await generateKeypair();
      const jwks = await exportKeypair(keypair);
      const fingerprint = await fingerprintPublicKey(keypair);

      set({ ...self, id, jwks, keypair, fingerprint });
    }

    return get() as Required<IdentityState>;
  },
});

export const useIdentStore = create<IdentityState>()(
  devtools(
    persist(stateCreator, {
      // persist options
      name: "skypod-identity",

      // we encrypt in localstorage, with a browser-bound encryption
      storage: makeSerdeStorage(
        makePrivateBoundStorage(localStorage),

        // since the keypair isn't serializable, but jwk is
        // ignore keypair on flush, reload on read

        async function serialize(state: IdentityState) {
          const { keypair, ...rest } = state;
          return rest;
        },

        async function deserialize(rest) {
          const keypair = await importKeypair(rest.jwks)
          return { ...rest, keypair };
        },
      ),

      // deep merge
      merge(persistedState, currentState) {
        return merge(
          currentState,
          persistedState as any,
        ) as unknown as IdentityState;
      },
    }),
    {
      // devtools options
      name: "ident-store",
    },
  ),
);

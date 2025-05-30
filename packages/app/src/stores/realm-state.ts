import { type StateCreator } from "zustand";
import { z } from "zod";

import { useIdentStore } from ".";
import { identIdSchema } from "./ident-id";
import { generateRealmId, realmIdSchema } from "./realm-id";
import { jwkSchema } from "../schema/jwk";

//
// peer identity
// enough to identify and use their public key

export const peerIdentSchema = z.object({
  id: identIdSchema,
  os: z.string(),
  device: z.string(),
  browser: z.string(),
  installed: z.boolean(),

  pubicJwks: jwkSchema,
  publicThumb: z.string(),
});

export type PeerIdent = z.infer<typeof peerIdentSchema>;

//
// realm
// a common key-space for peers that sync
// eventually server sync will be a peer too

export const realmDataSchema = z.object({
  id: realmIdSchema,
  peers: z.record(identIdSchema, peerIdentSchema),
});

export type RealmData = z.infer<typeof realmDataSchema>;

export type RealmActions = {
  create: () => Promise<void>;
  join: (invite: unknown) => Promise<void>;
};

export type RealmState = Partial<RealmData> & RealmActions;

//
// creator
// assumes the state is created in a persisted+devtools context

export const realmStateCreator: StateCreator<
  RealmState,
  [["zustand/devtools", never], ["zustand/persist", unknown]],
  [],
  RealmState
> = (set) => ({
  create: async () => {
    const ident = await useIdentStore.getState().ensure();

    // todo: this should save this to the server
    // todo: if the server fails, we can still create a realm, but it won't be signallable; what should we do?
    set(
      {
        id: generateRealmId(),
        peers: {
          [ident.id]: {
            id: ident.id,
            os: ident.os,
            device: ident.device,
            browser: ident.browser,
            installed: ident.installed,

            pubicJwks: ident.jwks.publicKey,
            publicThumb: ident.thumb,
          },
        },
      },
      undefined,
      "realm/create",
    );
  },

  join: async (_invite: unknown) => {
    // todo
  },
});

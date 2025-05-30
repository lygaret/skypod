import { type StateCreator } from "zustand";
import { z } from "zod";

import { useIdentStore } from ".";
import { identIdSchema } from "./ident-id";
import { generateRealmId, realmIdSchema } from "./realm-id";
import { jwkSchema } from "../schema/jwk";
import { importCryptoSystem, type CryptoSystem } from "../crypto";
import {
  deriveKeys,
  encrAlgo,
  exportKey,
  hmacAlgo,
  importKey,
} from "../crypto-keys";

//
// peer identity
// enough to identify and use their public key

export const peerIdentSchema = z.object({
  id: identIdSchema,
  os: z.string(),
  device: z.string(),
  browser: z.string(),
  installed: z.boolean(),

  publicJwk: jwkSchema,
  publicThumb: z.string(),
});

export type PeerIdent = z.infer<typeof peerIdentSchema>;

//
// realm
// a common key-space for peers that sync
// eventually server sync will be a peer too

export const realmDataSchema = z.object({
  id: realmIdSchema,
  hmacJwk: jwkSchema,
  encrJwk: jwkSchema,

  peers: z.record(identIdSchema, peerIdentSchema),
});

export type RealmData = z.infer<typeof realmDataSchema> & {
  crypto: CryptoSystem;
};

export interface RealmActions {
  create: () => Promise<void>;

  generateInvite: () => Promise<unknown>;
  exchangeInvite: (invite: unknown, sharedkey: unknown) => Promise<void>;
}

export type RealmState = Partial<RealmData> & RealmActions;
export type SerializedRealmState = Omit<RealmState, "crypto">;

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
    const realmId = generateRealmId();
    const ident = await useIdentStore.getState().ensure();

    const derivedKeys = await deriveKeys(realmId, () => [realmId]);
    const crypto = importCryptoSystem(async () => derivedKeys);
    const hmacJwk = await exportKey(derivedKeys.hmacKey);
    const encrJwk = await exportKey(derivedKeys.encrKey);

    // todo: this should save this to the server
    // todo: if the server fails, we can still create a realm, but it won't be signallable; what should we do?
    set(
      {
        id: realmId,
        crypto,
        hmacJwk,
        encrJwk,

        peers: {
          [ident.id]: {
            id: ident.id,
            os: ident.os,
            device: ident.device,
            browser: ident.browser,
            installed: ident.installed,

            publicJwk: ident.jwks.publicKey,
            publicThumb: ident.thumb,
          },
        },
      },
      undefined,
      "realm/create",
    );
  },

  generateInvite: async () => {
    // TODO
    // the plan:
    //   * generate ephemeral keypair
    //   * encrypt the shared realm key with the ephemeral key
    //   * post to signalling server:
    //     - ~{ realm_id, invite_id, ephemeral_public, encrypted_realm_key }~
    //   * generate QR code with two JWTs embedded
    //     - ~{ realm_id, invite_id, issuer: ident.jwks.public_key }~
    //       - signed by me, so server knows who created it
    //     - ~{ realm_id, invite_id, ephemeral_private }~
    //       - signed with ephemeral private key
    //   * trash the keys
  },

  exchangeInvite: async (_invite, _sharedkey) => {
    // TODO
    // the plan
    //   * submit invite to server, to get invite info
    //     - ~{ realm_id, invite_id, ephemeral_public, encrypted_realm_key }~
    //   * verify sharedkey signature with ephemeral_public from invite
    //     - ~{ realm_id, invite_id, ephemeral_private }~
    //   * use ephemeral_private to decrypt realm_key
    //   * trash the keys
  },
});

//
// serialization
// we omit the keys during serialization, since they're non-enumerable,
// and we rebuild it on deserialization from the jwks

export async function realmStateSerialize(
  state: RealmState,
): Promise<SerializedRealmState> {
  const { crypto, ...rest } = state;
  return rest;
}

export async function realmStateDeserialize(
  rest: SerializedRealmState,
): Promise<RealmState> {
  if (rest.encrJwk && rest.hmacJwk) {
    const { encrJwk, hmacJwk } = rest;
    const crypto = importCryptoSystem(async () => {
      const [hmacKey, encrKey] = await Promise.all([
        importKey(hmacJwk, hmacAlgo, ["sign", "verify"]),
        importKey(encrJwk, encrAlgo, ["encrypt", "decrypt"]),
      ]);

      return { encrKey, hmacKey };
    });

    return { ...rest, crypto };
  }

  return rest;
}

import { nanoid } from "nanoid";
import { type StateCreator } from "zustand";
import { z } from "zod";

import { importCryptoSystem, type CryptoSystem } from "../../crypto";
import {
  deriveKeys,
  encrAlgo,
  exportKey,
  hmacAlgo,
  importKey,
} from "../../crypto-keys";
import { jwkSchema } from "../../schema/jwk";
import { type inferBrandedId, makeBrandedId } from "../../schema/branded-id";

import { useIdentStore } from "..";
import { identIdSchema } from "./ident";

// branded id

const brand = makeBrandedId("rlm", 16);

export type RealmId = inferBrandedId<typeof brand>;
export const {
  generator: generateRealmId,
  validator: validateRealmId,
  schema: realmIdSchema,
} = brand;

// the state object

/**
 * peer identity schema with public key information
 * contains enough information to identify and verify a peer device
 */
export const peerIdentSchema = z.object({
  id: identIdSchema,
  os: z.string(),
  device: z.string(),
  browser: z.string(),
  installed: z.boolean(),

  publicJwk: jwkSchema,
  publicThumb: z.string(),
});

/**
 * peer identity data type
 */
export type PeerIdent = z.infer<typeof peerIdentSchema>;

/**
 * realm schema defining a shared keyspace for peer synchronization
 * eventually server sync will be a peer too
 */
export const realmDataSchema = z.object({
  id: realmIdSchema,
  hmacJwk: jwkSchema,
  encrJwk: jwkSchema,

  peers: z.record(identIdSchema, peerIdentSchema),
});

/** complete realm data including runtime crypto system */
export type RealmData = z.infer<typeof realmDataSchema> & {
  crypto: CryptoSystem;
};

/** actions available on the realm store */
export interface RealmActions {
  /**
   * creates a new realm with the current device as the first peer
   * generates encryption keys and establishes the peer list
   */
  create: () => Promise<void>;

  /**
   * generates an invitation for other devices to join this realm
   *
   * @returns invitation data for QR code or other sharing methods
   * @todo implement JWT-based invitation system with ephemeral keys
   */
  generateInvite: () => Promise<unknown>;

  /**
   * processes an invitation to join an existing realm
   *
   * @param invite - invitation data from another device
   * @param sharedkey - shared key for accessing realm encryption
   * @todo implement invitation verification and realm key decryption
   */
  exchangeInvite: (invite: unknown, sharedkey: unknown) => Promise<void>;
}

export type RealmState = Partial<RealmData> & RealmActions;
export type SerializedRealmState = Omit<RealmState, "crypto">;

/**
 * state creator for realm management
 * assumes the state is created in a persisted+devtools context
 */
export const realmStateCreator: StateCreator<
  RealmState,
  [["zustand/devtools", never], ["zustand/persist", unknown]],
  [],
  RealmState
> = (set) => ({
  create: async () => {
    const realmId = generateRealmId();
    const ident = await useIdentStore.getState().ensure();

    // todo: we should show this somewhere; if these are known, we can rederive keys
    const nonce = nanoid(32);
    console.log("recovery key:", { realmId, nonce });

    const derivedKeys = await deriveKeys(() => [realmId], realmId, nonce);
    const hmacJwk = await exportKey(derivedKeys.hmacKey);
    const encrJwk = await exportKey(derivedKeys.encrKey);
    const crypto = importCryptoSystem(async () => derivedKeys);

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

/**
 * serializes realm state for persistence
 * omits the crypto system since it's non-enumerable and rebuilt from jwks
 * @param state - realm state to serialize
 * @returns serializable state without crypto system
 */
export async function realmStateSerialize(
  state: RealmState,
): Promise<SerializedRealmState> {
  const { crypto, ...rest } = state;
  return rest;
}

/**
 * deserializes realm state from persistence
 * rebuilds the crypto system from stored jwks if available
 * @param rest - serialized realm state
 * @returns realm state with reconstructed crypto system
 */
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

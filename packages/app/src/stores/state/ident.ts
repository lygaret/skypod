import { UAParser } from "ua-parser-js";
import { isStandalonePWA } from "ua-parser-js/helpers";

import { z } from "zod";
import { type StateCreator } from "zustand";

import {
  exportKeypair,
  fingerprintKey,
  importKeypair,
} from "../../crypto-keys";
import { jwkPairSchema } from "../../schema/jwk";
import { makeBrandedId, type inferBrandedId } from "../../schema/branded-id";

// branded id

const identIdBrand = makeBrandedId("idt", 24);

export type IdentId = inferBrandedId<typeof identIdBrand>;
export const {
  generator: generateIdentId,
  validator: validateIdentId,
  schema: identIdSchema,
} = identIdBrand;

// identity key generation

const identityKeyAlgo = { name: "ECDSA", namedCurve: "P-256" };

async function generateKeypair() {
  return await crypto.subtle.generateKey(identityKeyAlgo, true, [
    "sign",
    "verify",
  ]);
}

// the state object

/**
 * device identity with keypairs and device information
 * we don't differentiate between users, just devices in a realm
 */
export const identityDataSchema = z.object({
  id: identIdSchema,

  os: z.string(),
  device: z.string(),
  browser: z.string(),
  installed: z.boolean(),

  jwks: jwkPairSchema,
  thumb: z.string(),
});

/** complete identity data including runtime keypair */
export type IdentityData = z.infer<typeof identityDataSchema> & {
  keypair: CryptoKeyPair;
};

/** actions available on the identity store */
export interface IdentityActions {
  /**
   * ensures the device has a complete identity, generating one if needed
   * @returns complete identity state with keypair and device info
   */
  ensure: () => Promise<Required<IdentityState>>;
}

export type IdentityState = Partial<IdentityData> & IdentityActions;
export type SerializedIdentityState = Omit<IdentityState, "keypair">;

/**
 * state creator for identity management
 * assumes the store is created in a persisted+devtools context
 */
export const identStateCreator: StateCreator<
  IdentityState,
  [["zustand/devtools", never], ["zustand/persist", unknown]],
  [],
  IdentityState
> = (set, get) => ({
  ensure: async () => {
    const self = get();
    if (!self.keypair) {
      const keypair = await generateKeypair();
      const parser = await UAParser().withFeatureCheck();

      set(
        {
          id: generateIdentId(),
          jwks: await exportKeypair(keypair),
          thumb: await fingerprintKey(keypair.publicKey),
          keypair,

          os: parser.os.toString(),
          device: parser.device.toString(),
          browser: parser.browser.toString(),
          installed: isStandalonePWA(),
        },
        undefined,
        "ident/ensure",
      );
    }

    return get() as Required<IdentityState>;
  },
});

/**
 * serializes identity state for persistence
 * omits the keypair since it's non-enumerable and rebuilt from jwks
 * @param state - identity state to serialize
 * @returns serializable state without keypair
 */
export async function identStateSerialize(
  state: IdentityState,
): Promise<SerializedIdentityState> {
  const { keypair, ...rest } = state;
  return rest;
}

/**
 * deserializes identity state from persistence
 * rebuilds the keypair from stored jwks if available
 * @param rest - serialized identity state
 * @returns identity state with reconstructed keypair
 */
export async function identStateDeserialize(
  rest: SerializedIdentityState,
): Promise<IdentityState> {
  if (rest.jwks) {
    const keypair = await importKeypair(rest.jwks, identityKeyAlgo);
    return { ...rest, keypair };
  }

  return rest;
}

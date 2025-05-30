import { UAParser } from "ua-parser-js";
import { isStandalonePWA } from "ua-parser-js/helpers";

import { z } from "zod";
import { type StateCreator } from "zustand";

import { jwkPairSchema } from "../schema/jwk";
import { generateIdentId, identIdSchema } from "./ident-id";
import { generateKeypair, identityKeyAlgo } from "./ident-keys";
import { exportKeypair, fingerprintKey, importKeypair } from "../crypto";

//
// identity
// a _device_ identity with keypairs (in easy to store/use formats)
// we don't make any differentiation between users, just devices in a realm

export const identityDataSchema = z.object({
  id: identIdSchema,

  os: z.string(),
  device: z.string(),
  browser: z.string(),
  installed: z.boolean(),

  jwks: jwkPairSchema,
  thumb: z.string(),
});

export type IdentityData = z.infer<typeof identityDataSchema> & {
  keypair: CryptoKeyPair;
};

export interface IdentityActions {
  ensure: () => Promise<Required<IdentityState>>;
}

export type IdentityState = Partial<IdentityData> & IdentityActions;
export type SerializedIdentityState = Omit<IdentityState, "keypair">;

//
// creator
// assumes the store is created in a persisted+devtools context

export const identStateCreator: StateCreator<
  IdentityState,
  [["zustand/devtools", never], ["zustand/persist", unknown]],
  [],
  SerializedIdentityState
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

//
// serialization
// we omit the keypair during serialization, since it's non-enumerable,
// and we rebuild it on deserialization from the jwks

export async function identStateSerialize(
  state: IdentityState,
): Promise<SerializedIdentityState> {
  const { keypair, ...rest } = state;
  return rest;
}

export async function identStateDeserialize(
  rest: SerializedIdentityState,
): Promise<IdentityState> {
  if (rest.jwks) {
    const keypair = await importKeypair(rest.jwks, identityKeyAlgo);
    return { ...rest, keypair };
  }

  return rest;
}

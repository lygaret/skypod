import { z } from "zod";
import { type StateCreator } from "zustand";

import { jwkPairSchema } from "../schema/jwk";
import { generateIdentId, identIdSchema } from "./ident-id";
import {
  exportKeypair,
  fingerprintPublicKey,
  generateKeypair,
  importKeypair,
} from "./ident-keys";

//
// identity
// a _device_ identity with keypairs (in easy to store/use formats)
// we don't make any differentiation between users, just devices in a realm

export const identityDataSchema = z.object({
  id: identIdSchema,
  thumb: z.string(),
  jwks: jwkPairSchema,
});

export type IdentityData = z.infer<typeof identityDataSchema> & {
  keypair: CryptoKeyPair;
};

export type IdentityActions = {
  ensure: () => Promise<Required<IdentityState>>;
};

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
      const thumb = await fingerprintPublicKey(keypair);

      set({ ...self, id, jwks, keypair, thumb }, undefined, "ident/generate");
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
  if (rest && rest.jwks) {
    const keypair = await importKeypair(rest.jwks);
    return { ...rest, keypair };
  }

  return rest;
}

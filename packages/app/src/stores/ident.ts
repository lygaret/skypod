import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

import type { JsonWebKeyPair } from "./types"
import { makeSerdeStorage } from './serde-storage';

export type Slice = {
  keypair?: CryptoKeyPair,
  ensure: () => Promise<CryptoKeyPair>,

  fingerprint: () => Promise<string>,
  exportJwk: () => Promise<JsonWebKey>,

  sign: (payload: unknown) => Promise<void>,
  encrypt: (payload: unknown) => Promise<void>,
}

// same as the slice, but with keys swapped for something serializable
type SerializedSlice = Omit<Slice, 'keypair'> & {
  keypair?: JsonWebKeyPair
};

export const useIdentStore = create<Slice>()(
  devtools(
    persist(
      (set, get) => ({
        keypair: undefined,

        ensure: async () => {
          const self = get();
          if (self.keypair != undefined)
            return self.keypair

          const keypair = await window.crypto.subtle.generateKey(
            { name: 'Ed25519' },
            true,
            ["sign", "verify"]
          );

          set({ ...self, keypair })
          return keypair
        },

        fingerprint: async () => {
          const self = get();
          const keypair = await self.ensure();

          const spki = await crypto.subtle.exportKey('spki', keypair.publicKey);
          const hash = await crypto.subtle.digest('SHA-256', spki);

          return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        },

        exportJwk: async () => {
          const self = get();
          const keypair = await self.ensure();

          return await crypto.subtle.exportKey('jwk', keypair.publicKey);
        },

        sign: async (_payload: any) => {
          // todo
        },

        encrypt: async (_payload: any) => {
          // todo
        }
      }),
      {
        name: 'skypod-identity',
        storage: makeSerdeStorage(
          () => localStorage,

          // jwks <-> cryptokeys
          // jwk is serializable

          async function serialize(state: Slice) {
            let keypair: undefined | JsonWebKeyPair
            if (state.keypair) {
              const publicKey = await crypto.subtle.exportKey('jwk', state.keypair.publicKey);
              const privateKey = await crypto.subtle.exportKey('jwk', state.keypair.privateKey);
              keypair = { publicKey, privateKey }
            }

            return { ...state, keypair };
          },

          async function deserialize(state: SerializedSlice) {
            let keypair: undefined | CryptoKeyPair = undefined
            if (state.keypair) {
              try {
                const publicKey = await crypto.subtle.importKey('jwk', state.keypair.publicKey, { name: 'Ed25519' }, true, ["verify"])
                const privateKey = await crypto.subtle.importKey('jwk', state.keypair.privateKey, { name: 'Ed25519' }, true, ["sign"])
                keypair = { publicKey, privateKey }
              } catch (e) {
                console.error('couldnt import keys?', e);
              }
            }

            return { ...state, keypair }
          }
        ),
      }
    )
  )
);

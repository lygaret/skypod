import { nanoid } from "nanoid";
import type { StateStorage } from "zustand/middleware";

import { deriveCryptoSystem, type CryptoSystem } from "../../crypto";

function isEncryptionEnabled(enabled?: boolean) {
  return enabled ?? !import.meta.env.DEV;
}

function isEncryptedValue(value?: unknown): value is string {
  return value != null && typeof value === "string" && value.startsWith("enc:");
}

/** create a storage that's cryptographically bound to the current install if encrypt is true */
export function makeInstallBoundStorage(
  name: string,
  encrypt: boolean | undefined,
  baseStorage: StateStorage,
): StateStorage {
  if (!isEncryptionEnabled(encrypt)) return baseStorage;

  function fingerprintInstall() {
    return [location.origin, navigator.language, navigator.userAgent];
  }

  async function ensureNonce() {
    const key = `nonce:${name}`;
    let nonce = await baseStorage.getItem(key);
    if (!nonce) {
      nonce = nanoid(32);
      await baseStorage.setItem(key, nonce);
    }

    return nonce;
  }

  let crypto: CryptoSystem | undefined;
  async function ensureCrypto() {
    return (crypto ??= deriveCryptoSystem(
      fingerprintInstall,
      name,
      await ensureNonce(),
    ));
  }

  return {
    async getItem(name: string) {
      const value = await Promise.resolve(baseStorage.getItem(name));
      if (!isEncryptedValue(value)) {
        return null;
      }

      const crypto = await ensureCrypto();
      return await crypto.decrypt(value.slice(4));
    },

    async setItem(name: string, value: string) {
      const crypto = await ensureCrypto();
      baseStorage.setItem(name, `enc:${await crypto.encrypt(value)}`);
    },

    removeItem(name: string) {
      baseStorage.removeItem(name);
    },
  };
}

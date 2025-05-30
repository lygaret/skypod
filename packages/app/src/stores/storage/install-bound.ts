import type { StateStorage } from "zustand/middleware";
import { makeCryptoSystem } from "../../crypto";

function isEncryptionEnabled(enabled?: boolean) {
  return enabled === undefined ? !import.meta.env.DEV : enabled;
}

function isEncryptedValue(value?: unknown): value is string {
  return value != null && typeof value === "string" && value.startsWith("enc:");
}

function fingerprintInstall() {
  return [location.origin, navigator.language, navigator.userAgent];
}

export function makeInstallBoundStorage(
  name: string,
  encrypt: boolean | undefined,
  baseStorage: StateStorage,
): StateStorage {
  if (!isEncryptionEnabled(encrypt)) return baseStorage;

  const crypto = makeCryptoSystem(name, true, fingerprintInstall);
  return {
    async getItem(name: string) {
      let value = await Promise.resolve(baseStorage.getItem(name));
      if (!isEncryptedValue(value)) {
        return null;
      }

      return await crypto.decrypt(value.slice(4));
    },

    async setItem(name: string, value: string) {
      baseStorage.setItem(name, `enc:${await crypto.encrypt(value)}`);
    },

    removeItem(name: string) {
      baseStorage.removeItem(name);
    },
  };
}

import type { StateStorage } from "zustand/middleware";
import { makeCryptoSystem } from "../crypto";

const fingerprintDevice = () => [
  location.origin,
  navigator.language,
  navigator.userAgent,
];

export function makePrivateBoundStorage(
  name: string,
  enabled: boolean | undefined,
  baseStorage: StateStorage,
): StateStorage {
  const crypto = makeCryptoSystem(name, true, fingerprintDevice);
  const should = enabled === undefined ? !import.meta.env.DEV : enabled;

  return {
    async getItem(name: string) {
      let value = await Promise.resolve(baseStorage.getItem(name));
      if (
        should &&
        value &&
        typeof value === "string" &&
        value.startsWith("enc:")
      ) {
        value = await crypto.decrypt(value.slice(4));
      }

      return value;
    },

    async setItem(name: string, value: string) {
      if (should) {
        const encrypted = `enc:${await crypto.encrypt(value)}`;
        baseStorage.setItem(name, encrypted);
      } else {
        baseStorage.setItem(name, value);
      }
    },

    removeItem(name: string) {
      baseStorage.removeItem(name);
    },
  };
}

import { nanoid } from "nanoid";
import { deriveKey } from "./crypto-keys";

/** encrypt/decrypt using AES-GCM authenticated encryption */
export interface CryptoSystem {
  /**
   * @param data - plaintext string to encrypt
   * @returns base64-encoded encrypted data with IV and authentication tag
   */
  encrypt(input: string): Promise<string>;

  /**
   * @param encryptedData - base64-encoded encrypted data with IV and authentication tag
   * @returns original plaintext string
   * @throws {Error} if authentication fails or data is corrupted
   */
  decrypt(input: string): Promise<string>;
}

/**
 * creates a crypto system with key derivation
 * if a stable password/salt/nonce is given, the derived keys will be stable
 *
 * @param password - string to use for deriving the encryption keys
 * @param salt - string to use as a solt prefix (probably the crypto system name)
 * @param nonce - second string to use as a solt prefix (probably a random string stored locally)
 * @returns crypto system with keys derived from fingerprints and nonce
 */
export function deriveCryptoSystem(
  password?: string,
  salt?: string,
  nonce?: string,
): CryptoSystem {
  const orRandom = (s?: string) => s ?? nanoid(32);

  return importCryptoSystem(async () => {
    return await deriveKey(orRandom(password), orRandom(salt), orRandom(nonce));
  });
}

/**
 * creates a crypto system from a key provider function
 * key function won't be called until needed
 *
 * encryption with aes-gcm, random iv
 * this gives us authenticated, so we don't need another hmac
 * TODO: is this correct?
 *
 * @param ensureKeys - function that returns encryption key
 * @returns crypto system with encrypt/decrypt methods
 */
export function importCryptoSystem(
  ensureKeys: () => Promise<CryptoKey>,
): CryptoSystem {
  let cachedKey: CryptoKey | undefined;
  const fetchKey = async () => {
    return (cachedKey ??= await ensureKeys());
  };

  return {
    async encrypt(data: string): Promise<string> {
      const encrKey = await fetchKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(data);

      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        encrKey,
        encoded,
      );

      // Combine IV + encrypted data (which includes auth tag)
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      return btoa(String.fromCharCode(...combined));
    },

    async decrypt(encryptedData: string): Promise<string> {
      const encrKey = await fetchKey();
      const combined = new Uint8Array(
        atob(encryptedData)
          .split("")
          .map((c) => c.charCodeAt(0)),
      );

      // Extract IV and encrypted data (which includes auth tag)
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        encrKey,
        encrypted,
      );

      return new TextDecoder().decode(decrypted);
    },
  };
}

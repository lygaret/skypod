import { nanoid } from "nanoid";
import { deriveKeys, type DerivedKeys } from "./crypto-keys";

/** encrypt/decrypt using AES-GCM with HMAC authentication */
export interface CryptoSystem {
  /**
   * @param data - plaintext string to encrypt
   * @returns base64-encoded encrypted data with IV and HMAC signature
   */
  encrypt(input: string): Promise<string>;

  /**
   * @param encryptedData - base64-encoded encrypted data with IV and HMAC
   * @returns original plaintext string
   * @throws {Error} if HMAC verification fails or data is corrupted
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
    return await deriveKeys(
      orRandom(password),
      orRandom(salt),
      orRandom(nonce),
    );
  });
}

/**
 * creates a crypto system from a key provider function
 * key function won't be called until needed
 *
 * @param ensureKeys - function that returns encryption and HMAC keys
 * @returns crypto system with encrypt/decrypt methods
 */
export function importCryptoSystem(
  ensureKeys: () => Promise<DerivedKeys>,
): CryptoSystem {
  let cachedKeys: DerivedKeys | undefined;
  const fetchKeys = async () => {
    return (cachedKeys ??= await ensureKeys());
  };

  return {
    async encrypt(data: string): Promise<string> {
      const { encrKey, hmacKey } = await fetchKeys();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(data);

      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        encrKey,
        encoded,
      );

      // Combine IV + encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Generate HMAC of the encrypted data
      const hmacSignature = await crypto.subtle.sign("HMAC", hmacKey, combined);

      // Combine encrypted data + HMAC signature
      const final = new Uint8Array(combined.length + hmacSignature.byteLength);
      final.set(combined);
      final.set(new Uint8Array(hmacSignature), combined.length);

      return btoa(String.fromCharCode(...final));
    },

    async decrypt(encryptedData: string): Promise<string> {
      const { encrKey, hmacKey } = await fetchKeys();
      const final = new Uint8Array(
        atob(encryptedData)
          .split("")
          .map((c) => c.charCodeAt(0)),
      );

      // Split encrypted data and HMAC (HMAC-SHA256 is 32 bytes)
      const hmacSize = 32;
      if (final.length < hmacSize) {
        throw new Error("Invalid encrypted data: too short for HMAC");
      }

      const combined = final.slice(0, -hmacSize);
      const storedHmac = final.slice(-hmacSize);

      // Verify HMAC
      const isValid = await crypto.subtle.verify(
        "HMAC",
        hmacKey,
        storedHmac,
        combined,
      );

      if (!isValid) {
        throw new Error(
          "HMAC verification failed: data may have been tampered with",
        );
      }

      // Extract IV and encrypted data
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

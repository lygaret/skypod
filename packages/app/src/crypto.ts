import { deriveKeys, type DerivedKeys } from "./crypto-keys";

export interface CryptoSystem {
  encrypt(input: string): Promise<string>;
  decrypt(input: string): Promise<string>;
}

export function importCryptoSystem(
  ensureKeys: () => Promise<DerivedKeys>,
): CryptoSystem {
  return {
    async encrypt(data: string): Promise<string> {
      const { encrKey, hmacKey } = await ensureKeys();
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
      const { encrKey, hmacKey } = await ensureKeys();
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

export function deriveCryptoSystem(
  name: string,
  storage: boolean,
  fingerprint: () => string[],
): CryptoSystem {
  let cachedNonce: string | undefined;
  let cachedDerivedKeys: DerivedKeys | undefined;

  // ensure we have a nonce for the crypto system
  // if there's no storage, we only hold it in memory
  function ensureNonce(): string {
    if (cachedNonce) return cachedNonce;

    // stored?
    const nonceKey = `${name}-nonce`;
    if (storage) {
      const stored = localStorage.getItem(nonceKey);
      if (stored) return stored;
    }

    // generate if not stored
    const values = crypto.getRandomValues(new Uint8Array(32));
    const nonce = btoa(String.fromCharCode(...values));
    if (storage) {
      localStorage.setItem(nonceKey, nonce);
    }

    // cache and return
    return (cachedNonce = nonce);
  }

  // fingerprints derive a shared password for generating keys
  // if fingerprints aren't available, the key is protected only by the nonce

  return importCryptoSystem(async () => {
    cachedDerivedKeys ??= await deriveKeys(name, fingerprint, ensureNonce());
    return cachedDerivedKeys;
  });
}

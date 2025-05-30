const PBKDF2_ITERATIONS = 100000;

export interface CryptoSystem {
  encrypt(input: string): Promise<string>;
  decrypt(input: string): Promise<string>;
}

interface DerivedKeys {
  encryptionKey: CryptoKey;
  hmacKey: CryptoKey;
}

export function makeCryptoSystem(
  name: string,
  storage: boolean,
  fingerprint: () => string[],
): CryptoSystem {
  // common salts
  const encrSalt = new TextEncoder().encode("${name}-encr-cryptosystem");
  const hmacSalt = new TextEncoder().encode("${name}-hmac-cryptosystem");
  const nonceKey = `${name}-nonce`;

  // cached data
  let cachedNonce: number[] | undefined;
  let cachedDerivedKeys: DerivedKeys | undefined;

  // ensure we have a nonce for the crypto system
  // if there's no storage, we only hold it in memory
  async function ensureNonce() {
    if (cachedNonce) return cachedNonce;

    // stored?
    if (storage) {
      const stored = localStorage.getItem(nonceKey);
      if (stored) {
        const binary = atob(stored);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        // cache and return
        cachedNonce = Array.from(bytes);
        return cachedNonce;
      }
    }

    // generate if not stored
    const values = crypto.getRandomValues(new Uint8Array(32));
    if (storage) {
      const nonce = btoa(String.fromCharCode(...values));
      localStorage.setItem(nonceKey, nonce);
    }

    // cache and return
    cachedNonce = Array.from(values);
    return cachedNonce;
  }

  // fingerprints derive a shared password for generating keys
  // if fingerprints aren't available, the key is protected only by the nonce
  async function ensureKeys(): Promise<DerivedKeys> {
    if (cachedDerivedKeys) return cachedDerivedKeys;

    const uniqueprint = fingerprint();
    const printdata = [...uniqueprint, location.origin].join("|");
    const encoded = new TextEncoder().encode(printdata);
    const material = await crypto.subtle.importKey(
      "raw",
      encoded,
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    const nonce = await ensureNonce();

    // combine salt + nonce for key derivation
    // derive encryption and hmac keys with different salts

    const encryptionSaltData = new Uint8Array(encrSalt.length + nonce.length);
    encryptionSaltData.set(encrSalt);
    encryptionSaltData.set(nonce, encrSalt.length);

    const encryptionKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
        salt: encryptionSaltData,
      },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );

    const hmacSaltData = new Uint8Array(hmacSalt.length + nonce.length);
    hmacSaltData.set(hmacSalt);
    hmacSaltData.set(nonce, hmacSalt.length);

    const hmacKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: hmacSaltData,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      material,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );

    cachedDerivedKeys = { encryptionKey, hmacKey };
    return cachedDerivedKeys;
  }

  async function encrypt(data: string): Promise<string> {
    const { encryptionKey, hmacKey } = await ensureKeys();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(data);

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      encryptionKey,
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
  }

  async function decrypt(encryptedData: string): Promise<string> {
    const { encryptionKey, hmacKey } = await ensureKeys();
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
      encryptionKey,
      encrypted,
    );

    return new TextDecoder().decode(decrypted);
  }

  return {
    encrypt,
    decrypt,
  };
}

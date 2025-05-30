import { jwkSchema, type JwkObject, type JwkPair } from "./schema/jwk";

// TODO, is there a better way of getting the algo type?
export type Algo = Parameters<typeof window.crypto.subtle.importKey>[2];
export const encryptionAlgo: Algo = { name: "AES-GCM", length: 256 };
export const hmacAlgo: Algo = { name: "HMAC", hash: "SHA-256" };

export interface CryptoSystem {
  encrypt(input: string): Promise<string>;
  decrypt(input: string): Promise<string>;
}

export interface DerivedKeys {
  encryptionKey: CryptoKey;
  hmacKey: CryptoKey;
}

export async function deriveKeys(
  name: string,
  fingerprint: () => string[],
  nonceStr?: string,
  iterations = 100000,
) {
  // combine salt + nonce for key derivation
  // derive encryption and hmac keys with different salts

  const encoder = new TextEncoder();
  const encrSalt = encoder.encode(`${name}-encr-cryptosystem`);
  const hmacSalt = encoder.encode(`${name}-hmac-cryptosystem`);
  const nonce = encoder.encode(
    nonceStr ?? `${name}-nonce-${Date.now().toString()}`,
  );

  // fingerprints as PBKDF inputs

  const printdata = fingerprint().join("|");
  const encoded = new TextEncoder().encode(printdata);
  const material = await crypto.subtle.importKey(
    "raw",
    encoded,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  // and finally return the derived keys

  const pbkdfAlgo = (salt: Uint8Array) => ({
    name: "PBKDF2",
    hash: "SHA-256",
    salt,
    iterations,
  });

  return {
    encryptionKey: await crypto.subtle.deriveKey(
      pbkdfAlgo(new Uint8Array([...encrSalt, ...nonce])),
      material,
      encryptionAlgo,
      true,
      ["encrypt", "decrypt"],
    ),

    hmacKey: await crypto.subtle.deriveKey(
      pbkdfAlgo(new Uint8Array([...hmacSalt, ...nonce])),
      material,
      hmacAlgo,
      true,
      ["sign", "verify"],
    ),
  };
}

export function importCryptoSystem(
  ensureKeys: () => Promise<DerivedKeys>,
): CryptoSystem {
  return {
    async encrypt(data: string): Promise<string> {
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
    },

    async decrypt(encryptedData: string): Promise<string> {
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

export async function exportKey(key: CryptoKey): Promise<JwkObject> {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  return jwkSchema.parse(jwk);
}

export async function exportKeypair(keypair: CryptoKeyPair): Promise<JwkPair> {
  const publicJwk = await crypto.subtle.exportKey("jwk", keypair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keypair.privateKey);

  return {
    publicKey: jwkSchema.parse(publicJwk),
    privateKey: jwkSchema.parse(privateJwk),
  };
}

export async function importKey(
  key: JwkObject,
  algo: Algo,
  usages: readonly KeyUsage[],
): Promise<CryptoKey> {
  return await crypto.subtle.importKey("jwk", key, algo, true, usages);
}

export async function importKeypair(
  keypair: JwkPair,
  algo: Algo,
): Promise<CryptoKeyPair> {
  const publicKey = await importKey(keypair.publicKey, algo, ["verify"]);
  const privateKey = await importKey(keypair.privateKey, algo, ["sign"]);

  return { publicKey, privateKey };
}

export async function fingerprintKey(key: CryptoKey) {
  const spki = await crypto.subtle.exportKey("spki", key);
  const hash = await crypto.subtle.digest("SHA-256", spki);

  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

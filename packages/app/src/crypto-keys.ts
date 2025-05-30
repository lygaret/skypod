import { jwkSchema, type JwkObject, type JwkPair } from "./schema/jwk";

// TODO, is there a better way of getting the algo type?
export type Algo = Parameters<typeof window.crypto.subtle.importKey>[2];
export const encrAlgo: Algo = { name: "AES-GCM", length: 256 };
export const hmacAlgo: Algo = { name: "HMAC", hash: "SHA-256" };

export interface DerivedKeys {
  encrKey: CryptoKey;
  hmacKey: CryptoKey;
}

export async function deriveKeys(
  name: string,
  fingerprint: () => string[],
  nonceStr?: string,
  iterations = 100000,
): Promise<DerivedKeys> {
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
    encrKey: await crypto.subtle.deriveKey(
      pbkdfAlgo(new Uint8Array([...encrSalt, ...nonce])),
      material,
      encrAlgo,
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

import { jwkSchema, type JwkObject, type JwkPair } from "./schema/jwk";

// TODO, is there a better way of getting the algo type?
export type Algo = Parameters<typeof window.crypto.subtle.importKey>[2];
export const encrAlgo: Algo = { name: "AES-GCM", length: 256 };
export const signAlgo: Algo = { name: "ECDSA", namedCurve: "P-256" };

// signinge key generation

export async function generateSigningKeypair(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(signAlgo, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
}

/**
 * derives encryption key using PBKDF2 from password
 * @param passwordStr - password string for key derivation
 * @param saltStr - salt string for key derivation
 * @param nonceStr - nonce string for key derivation
 * @param iterations - PBKDF2 iterations, defaults to 100,000
 * @returns encryption key for AES-GCM authenticated encryption
 */
export async function deriveKey(
  passwordStr: string,
  saltStr: string,
  nonceStr: string,
  iterations = 100000,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();

  const password = encoder.encode(`${passwordStr}-pass-cryptosystem`);
  const material = await crypto.subtle.importKey(
    "raw",
    password,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const salt = encoder.encode(`${saltStr}-salt-cryptosystem`);
  const nonce = encoder.encode(`${nonceStr}-nonce-cryptosystem`);
  const pbkdfAlgo = {
    name: "PBKDF2",
    hash: "SHA-256",
    salt: new Uint8Array([...salt, ...nonce]),
    iterations,
  };

  return await crypto.subtle.deriveKey(pbkdfAlgo, material, encrAlgo, true, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * exports a CryptoKey as a validated JWK object
 * @param key - CryptoKey to export
 * @returns validated JWK object
 */
export async function exportKey(key: CryptoKey): Promise<JwkObject> {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  return jwkSchema.parse(jwk);
}

/**
 * exports a CryptoKeyPair as validated JWK objects
 * @param keypair - CryptoKeyPair to export
 * @returns object with validated public and private JWK objects
 */
export async function exportKeypair(keypair: CryptoKeyPair): Promise<JwkPair> {
  const publicJwk = await crypto.subtle.exportKey("jwk", keypair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keypair.privateKey);

  return {
    publicKey: jwkSchema.parse(publicJwk),
    privateKey: jwkSchema.parse(privateJwk),
  };
}

/**
 * imports a JWK object as a CryptoKey
 * @param key - JWK object to import
 * @param algo - cryptographic algorithm for the key
 * @param usages - allowed key usages
 * @returns imported CryptoKey
 */
export async function importKey(
  key: JwkObject,
  algo: Algo,
  usages: readonly KeyUsage[],
): Promise<CryptoKey> {
  return await crypto.subtle.importKey("jwk", key, algo, true, usages);
}

/**
 * imports a JWK keypair as a CryptoKeyPair for signing operations
 * @param keypair - JWK keypair object with public and private keys
 * @param algo - cryptographic algorithm for the keypair
 * @returns imported CryptoKeyPair with verify/sign capabilities
 */
export async function importKeypair(
  keypair: JwkPair,
  algo: Algo,
): Promise<CryptoKeyPair> {
  const publicKey = await importKey(keypair.publicKey, algo, ["verify"]);
  const privateKey = await importKey(keypair.privateKey, algo, ["sign"]);

  return { publicKey, privateKey };
}

/**
 * generates a fingerprint of a public key
 * @param key - CryptoKey to fingerprint (should be a public key)
 * @returns hexadecimal string fingerprint of the key
 */
export async function fingerprintKey(key: CryptoKey) {
  const spki = await crypto.subtle.exportKey("spki", key);
  const hash = await crypto.subtle.digest("SHA-256", spki);

  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

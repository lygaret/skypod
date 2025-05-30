import type { JsonWebKeyPair } from "./types";

const IdentityKeyAlgo = {
  name: "ECDSA",
  namedCurve: "P-256",
};

export async function generateKeypair() {
  return await window.crypto.subtle.generateKey(IdentityKeyAlgo, true, [
    "sign",
    "verify",
  ]);
}

export async function exportKeypair(keypair?: CryptoKeyPair) {
  if (keypair == undefined) return undefined;

  const publicKey = await crypto.subtle.exportKey("jwk", keypair.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", keypair.privateKey);

  return { publicKey, privateKey };
}

export async function importKeypair(keypair?: JsonWebKeyPair) {
  if (keypair == undefined) return undefined;

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    keypair.publicKey,
    IdentityKeyAlgo,
    true,
    ["verify"],
  );
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    keypair.privateKey,
    IdentityKeyAlgo,
    true,
    ["sign"],
  );

  return { publicKey, privateKey };
}

export async function fingerprintPublicKey(keypair?: CryptoKeyPair) {
  if (keypair == undefined) return undefined;

  const spki = await crypto.subtle.exportKey("spki", keypair.publicKey);
  const hash = await crypto.subtle.digest("SHA-256", spki);

  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

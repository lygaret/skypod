import { jwkSchema, type JwkPair } from "../schema/jwk";

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

export async function exportKeypair(keypair: CryptoKeyPair): Promise<JwkPair> {
  const publicJwk = await crypto.subtle.exportKey("jwk", keypair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keypair.privateKey);

  return {
    publicKey: jwkSchema.parse(publicJwk),
    privateKey: jwkSchema.parse(privateJwk),
  };
}

export async function importKeypair(keypair: JwkPair): Promise<CryptoKeyPair> {
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

export async function fingerprintPublicKey(keypair: CryptoKeyPair) {
  const spki = await crypto.subtle.exportKey("spki", keypair.publicKey);
  const hash = await crypto.subtle.digest("SHA-256", spki);

  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

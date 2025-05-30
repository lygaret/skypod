export const identityKeyAlgo = {
  name: "ECDSA",
  namedCurve: "P-256",
};

export async function generateKeypair() {
  return await window.crypto.subtle.generateKey(identityKeyAlgo, true, [
    "sign",
    "verify",
  ]);
}

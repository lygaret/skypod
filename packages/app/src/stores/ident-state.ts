import type { IdentId } from "./ident-id";
import type { JsonWebKeyPair } from "./types";

export interface IdentityState {
  id?: IdentId;

  jwks?: JsonWebKeyPair;
  keypair?: CryptoKeyPair;
  fingerprint?: string;

  ensure: () => Promise<Required<IdentityState>>;
}

import type { IdentId } from "./ident-id";
import type { RealmId } from "./realm-id";

export interface PeerKey {
  jwk: JsonWebKey;
  fingerprint: string;
}

export interface RealmState {
  id?: RealmId;
  peers: Record<IdentId, PeerKey>;

  create: () => Promise<void>;
  join: (invite: unknown) => Promise<void>;
}

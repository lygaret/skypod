import { nanoid } from "nanoid";

const REALM_ID_PREFIX = "rlm-";
const REALM_ID_SIZE = 16;
const REALM_ID_PATTERN = /rlm-\w{16}/;

declare const __brand: unique symbol;
export type RealmId = string & { readonly [__brand]: "RealmId" };

export function generateRealmId(): RealmId {
  const id = nanoid(REALM_ID_SIZE);
  return `${REALM_ID_PREFIX}${id}` as RealmId;
}

export function isRealmId(input: string): input is RealmId {
  return REALM_ID_PATTERN.test(input);
}

import { makeBrandedId, type inferBrandedIdType } from "../schema/branded-id";

export const {
  generator: generateRealmId,
  validator: validateRealmId,
  schema: realmIdSchema,
} = makeBrandedId("rlm", 16);

export type RealmId = inferBrandedIdType<typeof realmIdSchema>;

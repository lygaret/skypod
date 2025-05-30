import { makeBrandedId, type inferBrandedIdType } from "../schema/branded-id";

export const {
  generator: generateIdentId,
  validator: validateIdentId,
  schema: identIdSchema,
} = makeBrandedId("idt", 24);

export type IdentId = inferBrandedIdType<typeof identIdSchema>;

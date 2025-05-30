import { nanoid } from "nanoid";
import { z } from "zod";
import escapeRegExp from "lodash-es/escapeRegExp";

export interface BrandedIdGenerator<T> {
  generator: () => T;
  schema: z.Schema<T>;
}

export type inferBrandedIdType<T extends z.ZodType> = z.infer<T>;

export function makeBrandedId(prefix: string, length = 16) {
  const brand = escapeRegExp(prefix);
  const pattern = `${brand}-[A-Za-z0-9_-]{${length.toString()}}`;
  const regex = new RegExp(pattern);

  const schema = z.string().regex(regex).brand(Symbol(brand));

  const generator = function () {
    const id = nanoid(length);
    return schema.parse(`${prefix}-${id}`);
  };

  const validator = function (input: string) {
    return schema.safeParse(input).success;
  };

  return {
    generator,
    validator,
    schema,
  };
}

import escapeRegExp from "lodash-es/escapeRegExp";
import { nanoid } from "nanoid";
import { z } from "zod";

/** result from a branded id maker invocation */
export interface BrandedIdResult<T extends string, Z extends z.ZodSchema> {
  generator: () => T;
  validator: (i: string) => i is T;
  schema: Z;
}

/** given a branded id maker, return the branded id type */
export type inferBrandedId<T> =
  T extends BrandedIdResult<infer U, infer _> ? U : never;

/**
 * creates a branded identifier system with prefix and validation
 *
 * @param prefix - string prefix for the identifier (e.g., "usr", "org")
 * @param length - length of the random portion, defaults to 16
 * @returns object with generator, validator, schema functions, and inferred type
 */
export function makeBrandedId(prefix: string, length = 16) {
  const brand = escapeRegExp(prefix);
  const pattern = `${brand}-[A-Za-z0-9_-]{${length.toString()}}`;
  const regex = new RegExp(pattern);

  const schema = z.string().regex(regex).brand(Symbol(brand));
  type BrandType = z.infer<typeof schema>;

  const generator = function (): BrandType {
    const id = nanoid(length);
    return schema.parse(`${prefix}-${id}`);
  };

  const validator = function (input: string): input is BrandType {
    return schema.safeParse(input).success;
  };

  return {
    generator,
    validator,
    schema,
  } satisfies BrandedIdResult<BrandType, typeof schema>;
}

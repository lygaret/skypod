import { z } from "zod";

const baseJWKSchema = z.object({
  kty: z.string(),
  use: z.string().optional(),
  key_ops: z.array(z.string()).optional(),
  alg: z.string().optional(),
  kid: z.string().optional(),
  x5u: z.string().optional(),
  x5c: z.array(z.string()).optional(),
  x5t: z.string().optional(),
  "x5t#S256": z.string().optional(),
});

const rsaKeySchema = baseJWKSchema.extend({
  kty: z.literal("RSA"),
  n: z.string(), // Required for RSA
  e: z.string(), // Required for RSA
  d: z.string().optional(),
  p: z.string().optional(),
  q: z.string().optional(),
  dp: z.string().optional(),
  dq: z.string().optional(),
  qi: z.string().optional(),
});

const ecKeySchema = baseJWKSchema.extend({
  kty: z.literal("EC"),
  crv: z.string(), // Required for EC
  x: z.string(), // Required for EC
  y: z.string().optional(), // Required for most curves, optional for Ed25519/Ed448
  d: z.string().optional(), // Private key
});

const symmetricKeySchema = baseJWKSchema.extend({
  kty: z.literal("oct"),
  k: z.string(), // Required for symmetric keys
});

export const jwkSchema = z.discriminatedUnion("kty", [
  rsaKeySchema,
  ecKeySchema,
  symmetricKeySchema,
]);

export const jwkPairSchema = z.object({
  publicKey: jwkSchema,
  privateKey: jwkSchema,
});

export type JwkObject = z.infer<typeof jwkSchema>;
export type JwkPair = z.infer<typeof jwkPairSchema>;

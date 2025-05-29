import { nanoid } from 'nanoid'

const IDENT_ID_PREFIX = 'idt-'
const IDENT_ID_SIZE   = 24
const IDENT_ID_PATTERN = /idt-\w{24}/

declare const __brand: unique symbol;
export type IdentId = string & { readonly [__brand]: 'IdentId' }

export function generateIdentId(): IdentId {
  const id = nanoid(IDENT_ID_SIZE)
  return `${IDENT_ID_PREFIX}${id}` as IdentId
}

export function isIdentId(input: string): input is IdentId {
  return IDENT_ID_PATTERN.test(input)
}

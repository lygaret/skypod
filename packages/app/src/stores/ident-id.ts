import { nanoid } from 'nanoid'

const IDENT_ID_PREFIX = 'idt-'
const IDENT_ID_SIZE   = 24

export function generateIdentId() {
  const id = nanoid(IDENT_ID_SIZE)
  return `${IDENT_ID_PREFIX}${id}`
}

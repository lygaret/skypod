import { nanoid } from 'nanoid'

const REALM_ID_PREFIX = 'rlm-'
const REALM_ID_SIZE = 16

export function generateRealmId() {
  const id = nanoid(REALM_ID_SIZE)
  return `${REALM_ID_PREFIX}${id}`
}

import React from "react"
import { useRealmStore } from "./stores"
import { useIdentStore } from "./stores"
import { fingerprintPublicKey } from "./stores/ident-keys"

export const Root: React.FC = () => {
  const realm = useRealmStore()
  const ident = useIdentStore()

  const startNew = async () => {
    try {
      await realm.create()
      console.log('realm created!')
    }
    catch (e) {
      console.error('got error', e);
    }
  }

  const generate = async () => {
    try {
      const i = await ident.ensure();
      const f = await fingerprintPublicKey(i.keypair)
      console.log('got fingerprint!', f)
    }
    catch (e) {
      console.error('got error', e);
    }
  };

  return (
    <>
      <React.Suspense fallback={<>Loading...</>}>
        <pre>{JSON.stringify(realm, null, 4)}</pre>
      </React.Suspense>

      <h1>Hello, World</h1>
      <p>What's up?</p>
      <button onClick={generate}>Generate</button>
      <button onClick={startNew}>Start Realm</button>
    </>
  )
}

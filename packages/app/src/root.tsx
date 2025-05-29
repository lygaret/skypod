import React from "react"
import { useRealmStore } from "./stores"
import { useIdentStore } from "./stores"

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

  return (
    <>
      <React.Suspense fallback={<>Loading...</>}>
        <pre>{JSON.stringify(realm, null, 4)}</pre>
      </React.Suspense>

      <h1>Hello, World</h1>
      <p>What's up?</p>
      <pre>{JSON.stringify(ident, null, 4)}</pre>
      <button onClick={startNew}>Start Realm</button>
    </>
  )
}

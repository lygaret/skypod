import React from "react";
import { useRealmStore } from "./stores";
import { useIdentStore } from "./stores";

export const Root: React.FC = () => {
  const ident = useIdentStore();
  const realm = useRealmStore();

  const startNew = async () => {
    try {
      await realm.create();
      console.log("realm created!");
    } catch (e) {
      console.error("got error", e);
    }
  };

  const initiateJoin = async () => {};

  if (realm.id == null) {
    return (
      <>
        <h1>Welcome</h1>
        <p>Select an option to get started:</p>
        <ul>
          <li>
            <button onClick={startNew}>Start a New Realm</button>
          </li>
          <li>
            <button onClick={initiateJoin}>Join an Existing Realm</button>
          </li>
        </ul>
      </>
    );
  } else {
    return (
      <>
        <h1>
          Welcome to <code>{realm.id}</code>
        </h1>
        <pre>{JSON.stringify(realm, null, 4)}</pre>
        <h2>Identity</h2>
        <pre>{JSON.stringify(ident, null, 4)}</pre>
      </>
    );
  }
};

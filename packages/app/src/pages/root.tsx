import React, { useState } from "react";
import { useIdentStore, useRealmStore } from "../stores";

export const Root: React.FC = () => {
  const ident = useIdentStore();
  const realm = useRealmStore();

  const [text, setText] = useState("");

  const startNew = () => {
    realm
      .create()
      .then(() => {
        console.log("realm created!");
      })
      .catch((e: unknown) => {
        console.error("got error", e);
      });
  };

  const initiateJoin = () => {
    console.log("initiate join");
  };

  const encryptData = () => {
    if (!text || !realm.crypto) return;

    realm.crypto
      .encrypt(text)
      .then((payload) => {
        setText(payload);
        console.log("we encrypted it:", payload);
      })
      .catch((e: unknown) => {
        console.error("couldn't encrypt!", e);
      });
  };

  const decryptData = () => {
    if (!text || !realm.crypto) return;

    realm.crypto
      .decrypt(text)
      .then((payload) => {
        setText(payload);
        console.log("we decrypted it:", payload);
      })
      .catch((e: unknown) => {
        console.error("couldn't decrypt", e);
      });
  };

  if (realm.id == null) {
    return (
      <>
        <h1>Welcome</h1>
        <p>Select an option to get started:</p>
        <ul>
          <li>
            <button type="button" onClick={startNew}>
              Start a New Realm
            </button>
          </li>
          <li>
            <button type="button" onClick={initiateJoin}>
              Join an Existing Realm
            </button>
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
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
        ></textarea>
        <button type="button" onClick={encryptData}>
          Encrypt
        </button>
        <button type="button" onClick={decryptData}>
          Decrypt
        </button>
        <hr />
        <h2>Realm</h2>
        <pre>{JSON.stringify(realm, null, 2)}</pre>
        <h2>Identity</h2>
        <pre>{JSON.stringify(ident, null, 2)}</pre>
      </>
    );
  }
};

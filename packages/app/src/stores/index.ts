import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { makePrivateBoundStorage } from "./storage-private-bound";
import { makeSerdeStorage } from "./storage-serde";

import {
  identStateCreator,
  identStateDeserialize,
  identStateSerialize,
} from "./ident-state";
import { realmStateCreator } from "./realm-state";

export const useIdentStore = create(
  devtools(
    persist(identStateCreator, {
      // we encrypt in localstorage, with a browser-bound encryption
      // we ignore keypair when serializing, and reimport when merging from storage
      name: "skypod-identity",
      storage: makeSerdeStorage(
        makePrivateBoundStorage(localStorage),
        identStateSerialize,
        identStateDeserialize,
      ),
    }),
    {
      // devtools options
      name: "ident-store",
    },
  ),
);

export const useRealmStore = create(
  devtools(
    persist(realmStateCreator, {
      // persist options
      // we encrypt in localstorage, with a browser-bound encryption
      name: "skypod-realm",
      storage: createJSONStorage(() => makePrivateBoundStorage(localStorage)),
    }),
    {
      // dev-tools options
      name: "skypod-realm",
      anonymousActionType: "realm/anonymous",
    },
  ),
);

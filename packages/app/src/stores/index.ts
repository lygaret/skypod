import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import {
  identStateCreator,
  identStateDeserialize,
  identStateSerialize,
} from "./ident-state";
import {
  realmStateCreator,
  realmStateDeserialize,
  realmStateSerialize,
} from "./realm-state";
import { makeSerializerStorage } from "./storage/serializer";
import { makeInstallBoundStorage } from "./storage/install-bound";

export const useIdentStore = create(
  devtools(
    persist(identStateCreator, {
      // we encrypt in localstorage, with a browser-bound encryption
      // we ignore keypair when serializing, and reimport when merging from storage
      name: "skypod-ident",
      storage: makeSerializerStorage(
        makeInstallBoundStorage("skypod-ident", undefined, localStorage),
        identStateSerialize,
        identStateDeserialize,
      ),
    }),
    {
      // devtools options
      name: "ident-store",
      anonymousActionType: "ident/anonymous",
    },
  ),
);

export const useRealmStore = create(
  devtools(
    persist(realmStateCreator, {
      // persist options
      // we encrypt in localstorage, with a browser-bound encryption
      name: "skypod-realm",
      storage: makeSerializerStorage(
        makeInstallBoundStorage("skypod-realm", undefined, localStorage),
        realmStateSerialize,
        realmStateDeserialize,
      ),
    }),
    {
      // dev-tools options
      name: "skypod-realm",
      anonymousActionType: "realm/anonymous",
    },
  ),
);

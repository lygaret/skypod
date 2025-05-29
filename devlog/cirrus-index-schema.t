import { RxCollectionCreator } from "rxdb";

export type RxCollectionRegistration<T> = RxCollectionCreator<T> & { 
    name: string 
}
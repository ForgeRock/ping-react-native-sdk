import { storage, type StorageInstance } from "@react-native-pingidentity/storage";

export type Dog = { name: string; type: string };
export type Cat = { name: string; color: string };

let dogStorage: StorageInstance<Dog> | null = null;
let catStorage: StorageInstance<Cat> | null = null;

export function configureDogStorage() {
  if (!dogStorage) {
    dogStorage = storage<Dog>({
      type: "memory",
      keyAlias: "dogKeyAlias",
      cacheStrategy: "no_cache",
    });
    console.log("🐶 Created Dog Storage:", dogStorage.id);
  }
  return dogStorage;
}

export function configureCatStorage() {
  if (!catStorage) {
    catStorage = storage<Cat>({
      type: "memory",
      keyAlias: "catKeyAlias",
      cacheStrategy: "no_cache",
    });
    console.log("🐱 Created Cat Storage:", catStorage.id);
  }
  return catStorage;
}

export function getAnimalStorages() {
  return { dogStorage, catStorage };
}

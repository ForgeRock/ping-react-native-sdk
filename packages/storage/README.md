# PingStorage SDK

The PingStorage SDK provides a flexible storage interface and a set of common
storage solutions for the Ping SDKs, serving React Native applications.

## Integrating the SDK into your project

```sh
npm install @react-native-pingidentity/storage
```

```sh
yarn add @react-native-pingidentity/storage
```

## How to use the SDK

### Creating and using a storage instance

To create a storage instance and use it to persist and retrieve data, follow
the example below:

```ts
import { storage } from '@react-native-pingidentity/storage';

// Define the data type that you want to persist
type Dog = {
  name: string;
  type: string;
};

const storageInstance = storage<Dog>({
  type: 'encrypted',
  keyAlias: 'ping-storage-key',
  fileName: 'dogs.json',
});

await storageInstance.save({ name: 'Lucky', type: 'Golden Retriever' });
const storedData = await storageInstance.getItem();
await storageInstance.delete();
```

Encrypted storage uses the platform keystore to store data securely.

### Enabling cache for the storage

You can enable cache for the storage as follows, by default cache is disabled:

```ts
const storageInstance = storage<Dog>({
  type: 'encrypted',
  cacheStrategy: 'CACHE',
});
```

Note: cache strategies store data in memory as plain text.

### Adding encryption behavior

Encrypted storage uses the platform keystore by default. You can tune encryption
behavior for Android by specifying a key alias and enforcing asymmetric key
usage:

```ts
const storageInstance = storage<Dog>({
  type: 'encrypted',
  keyAlias: 'ping-storage-key',
  enforceAsymmetricKey: true,
});
```

### Session and OIDC helpers

```ts
import {
  createSessionStorage,
  createOidcStorage,
} from '@react-native-pingidentity/storage';

const sessionStorage = createSessionStorage({ type: 'encrypted' });
const oidcStorage = createOidcStorage({ type: 'datastore' });
```

## API reference

### storage<T>(config)

Creates a strongly typed storage instance. `config.type` is required and must be
one of:

- `memory` - in-memory storage
- `encrypted` - secure storage backed by the platform keystore
- `datastore` - persistent datastore storage

### StorageInstance<T>

- `id: string` - native storage identifier
- `save(value: T): Promise<boolean>`
- `getItem(): Promise<T | null>`
- `delete(): Promise<boolean>`

### Configuration options

- `type` (required): `memory | encrypted | datastore`
- `keyAlias` (optional): key alias for encrypted storage
- `fileName` (optional): file name for encrypted or datastore storage
- `strongBoxPreferred` (optional): Android StrongBox preference
- `cacheStrategy` (optional): `NO_CACHE | CACHE | CACHE_ON_FAILURE`
- `enforceAsymmetricKey` (optional): enforce asymmetric key usage for encrypted storage

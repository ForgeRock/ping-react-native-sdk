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
  fileName: 'dogs_file',
});

await storageInstance.save({ name: 'Chewie', type: 'Poodle' });
const storedData = await storageInstance.getItem();
await storageInstance.deleteItem();
```

Encrypted storage uses the platform keystore to store data securely.

### Enabling cache for the storage

You can enable cache for the storage as follows. By default, cache is disabled (`no_cache`):

```ts
const storageInstance = storage<Dog>({
  type: 'encrypted',
  cacheStrategy: 'cache',
});
```

Available cache strategies:
- `no_cache` - No caching, always fetch fresh data (default)
- `cache` - Cache the item in memory, even if storage operation fails
- `cache_on_failure` - Cache only if storage operation fails only available in Android devices

Note: Cached data is stored in plain text and not encrypted.

### Working with multiple storage instances

You can create multiple storage instances for different data types. Each instance is independent and has its own unique identifier:

```ts
import { storage } from '@react-native-pingidentity/storage';

type User = { id: string; name: string };
type Settings = { theme: string; notifications: boolean };

// Create separate storage instances
const userStorage = storage<User>({
  type: 'encrypted',
  keyAlias: 'user-key',
  fileName: 'secure_file',
});

const settingsStorage = storage<Settings>({
  type: 'datastore',
  fileName: 'my_file_name',
});

// Use them independently
await userStorage.save({ id: '123', name: 'Alice' });
await settingsStorage.save({ theme: 'dark', notifications: true });
```

### Session and OIDC helpers

Helper functions are provided to create storage instances for common use cases:

```ts
import {
  createSessionStorage,
  createOidcStorage,
} from '@react-native-pingidentity/storage';

// Create session storage for Journey SSO tokens
const sessionStorage = createSessionStorage({
  type: 'encrypted',
  encrypted: true,
});

// Create OIDC storage for OAuth/OIDC tokens
const oidcStorage = createOidcStorage({
  type: 'datastore',
  encrypted: false,
});
```


[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-android-sdk)

# Ping Identity React Native Core

The Ping Identity React Native Core module hosts shared runtime utilities for Ping RN SDKs. It
provides process-wide registries for native handles so modules can keep platform resources alive
across bridge calls.

## Integrating the SDK into your project

Add the package and let autolinking wire the native code:

```bash
yarn add @react-native-pingidentity/core
cd ios && pod install
```

## How to Use the SDK

### Register native handles (Android)

Use the shared registry to keep native objects alive and retrievable by id:

```kotlin
import com.reactnativepingidentity.core.CoreRuntime
import com.reactnativepingidentity.core.registry.NativeHandle

class MyHandle : NativeHandle

val id = CoreRuntime.storageRegistry.register(MyHandle())
val handle = CoreRuntime.storageRegistry.resolve(id)
CoreRuntime.storageRegistry.remove(id)
```

### Register native handles (iOS)

```swift
import RNPingCore

final class MyHandle: NativeHandle {}

let id = await CoreRuntime.storageRegistry.register(MyHandle())
let handle = await CoreRuntime.storageRegistry.resolve(id)
await CoreRuntime.storageRegistry.remove(id)
```

### Clearing registries

Both platforms support clearing all tracked handles:

```kotlin
CoreRuntime.storageRegistry.removeAll()
```

```swift
await CoreRuntime.storageRegistry.removeAll()
```

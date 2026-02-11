<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Core

The Ping Identity React Native Core module hosts shared runtime utilities for Ping RN SDKs. It
provides process-wide registries for native handles, plus native error contracts used to keep
promise rejections consistent across modules.

## Integrating the SDK into your project

Add the package and let autolinking wire the native code:

```bash
yarn add @ping-identity/rn-core
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

Note: Android registry calls are synchronous. iOS uses async/await because the registry is
actor-isolated.

### Clearing registries

Both platforms support clearing all tracked handles:

```kotlin
CoreRuntime.storageRegistry.removeAll()
```

```swift
await CoreRuntime.storageRegistry.removeAll()
```

### Rejecting promises with shared error contracts

Core defines a shared error payload so native modules can reject with consistent, serializable
data. The shape mirrors `@ping-identity/rn-types` (type, error, message, code, status).

#### Android

```kotlin
import com.reactnativepingidentity.core.error.ErrorType
import com.reactnativepingidentity.core.error.GenericError
import com.reactnativepingidentity.core.error.reject

val error = GenericError(
  type = ErrorType.ARGUMENT_ERROR,
  error = "BROWSER_OPEN_ERROR",
  message = "Invalid URL"
)
promise.reject(error)
```

#### iOS

```swift
import RNPingCore

let error = GenericError(
  type: .argumentError,
  error: "BROWSER_OPEN_ERROR",
  message: "Invalid URL"
)
reject(error, rejecter: rejecter)
```

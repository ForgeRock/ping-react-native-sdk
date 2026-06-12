<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Push

Push MFA for React Native — enrollment, credential management, notification processing, and approve/deny/challenge/biometric responses.

## Table of contents

- [Installation](#installation)
- [Native setup](#native-setup)
  - [Scenario A — Using a React Native JS push library](#scenario-a--using-a-react-native-js-push-library)
  - [Scenario B — Already using another native push provider](#scenario-b--already-using-another-native-push-provider)
- [How to use the SDK](#how-to-use-the-sdk)
  - [React hook — recommended](#react-hook--recommended)
  - [PushClient method reference](#pushclient-method-reference)
- [Logging integration](#logging-integration-optional)
- [Push storage](#push-storage-optional)
- [Customisation](#customisation)
- [Error handling](#error-handling)
- [License](#license)

## Installation

> **Note:** This module requires that the `@ping-identity/rn-core` module is already set up and installed.

```bash
# Install & setup the core module
yarn add @ping-identity/rn-core
# Install the rn-push module
yarn add @ping-identity/rn-push
# If you are developing your app using iOS, run this command
cd ios && pod install
```

Optional integration packages:

```bash
yarn add @ping-identity/rn-logger   # JS/native log channel
yarn add @ping-identity/rn-storage  # custom push credential storage backend
```

**FCM peer dependency (Android)** — add to your app's `build.gradle`:

```gradle
dependencies {
    implementation platform('com.google.firebase:firebase-bom:33.0.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

**APNs setup (iOS)** — enable Push Notifications capability in Xcode and add the APNs key in your Apple Developer portal.

## Native setup

The SDK needs to receive the platform push token and incoming messages from your existing push infrastructure. Choose the scenario that matches your app.

### Scenario A — Using a React Native JS push library

No native code changes needed. Wire up token and message delivery from your JS push library to the SDK. The examples below use `@react-native-firebase/messaging` — adapt to your library as needed.

Ping sends **data-only messages** (no `notification` field), which means background handlers fire correctly even when the app is killed.

**`index.js` — background/quit handler, registered at the top level before `AppRegistry`:**

```ts
import { createPushClient } from '@ping-identity/rn-push';

yourPushLibrary.setBackgroundMessageHandler(async (message) => {
  const pushClient = await createPushClient();
  const notification = await pushClient.processNotification(message.data);
  if (notification) {
    // Post a tray notification using your library's display API
  }
});
```

**App setup — token wiring, foreground handler, and cold-start tap:**

```ts
import { PushProvider, usePush } from '@ping-identity/rn-push';

// Seed the token on startup and keep it fresh
const token = await yourPushLibrary.getToken();
await pushClient.setDeviceToken(token);
yourPushLibrary.onTokenRefresh((token) => {
  void pushClient.setDeviceToken(token);
});

// Foreground messages
yourPushLibrary.onMessage(async (message) => {
  // Use processNotification() if your library gives you a key-value data map.
  // Use processNotificationFromMessage() if it gives you a raw string payload.
  const notification = await pushClient.processNotification(message.data);
  if (notification) {
    /* show approve/deny UI */
  }
});

// Cold-start tap: app was killed and user tapped the tray notification.
yourPushLibrary.getInitialNotification().then(async (message) => {
  if (message) await pushClient.processNotification(message.data);
});
```

Then use `PushProvider` and `usePush` as normal — see [How to use the SDK](#how-to-use-the-sdk).

### Scenario B — Already using another native push provider

**Android** — add two lines to your existing `FirebaseMessagingService`:

```kotlin
override fun onNewToken(token: String) {
    existingSdk.updateToken(token)
    RNPingPushBridge.forwardToken(token) // ← add
}

override fun onMessageReceived(remoteMessage: RemoteMessage) {
    existingSdk.handleMessage(remoteMessage)
    RNPingPushBridge.forwardNotification(remoteMessage.data) // ← add
}
```

**iOS** — add to your existing `AppDelegate`. Set `UNUserNotificationCenter.current().delegate = self` in `didFinishLaunchingWithOptions` if not already set, then add:

```swift
func application(_ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    existingSdk.register(deviceToken)
    RNPingPushBridge.forwardToken(deviceToken) // ← add
}

func application(_ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    existingSdk.handleNotification(userInfo)
    RNPingPushBridge.forwardNotification(userInfo) // ← add
    completionHandler(.newData)
}

// Show banner when foregrounded
func userNotificationCenter(_ center: UNUserNotificationCenter, // ← add if not present
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    completionHandler([.banner, .sound, .badge])
}

// Forward banner taps to the Ping Push SDK
func userNotificationCenter(_ center: UNUserNotificationCenter, // ← add if not present
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void) {
    let userInfo = response.notification.request.content.userInfo
    RNPingPushBridge.forwardNotification(userInfo) // ← add
    completionHandler()
}
```

**Android — tray notification text**

If you want to post a tray notification when the app is backgrounded, use `RNPingPushBridge.extractNotificationText` to decode the message body from the JWT without reimplementing the logic yourself:

```kotlin
override fun onMessageReceived(remoteMessage: RemoteMessage) {
    existingSdk.handleMessage(remoteMessage)
    RNPingPushBridge.forwardNotification(remoteMessage.data)

    if (!isAppInForeground()) {
        val (title, body) = RNPingPushBridge.extractNotificationText(
            remoteMessage.data,
            getString(R.string.my_notification_title),
            getString(R.string.my_notification_body),
        )
        // post your tray notification using title and body
    }
}
```

---

## How to use the SDK

### React hook — recommended

`usePush` and `PushProvider` handle the full client lifecycle — creation, data fetching, token subscription, and cleanup.

**Wrap your navigator once:**

```tsx
import { PushProvider } from '@ping-identity/rn-push';

export default function App() {
  return (
    <PushProvider config={{ timeoutMs: 20000 }}>
      <NavigationContainer>{/* screens */}</NavigationContainer>
    </PushProvider>
  );
}
```

**Use in any descendant screen:**

```tsx
import { usePush } from '@ping-identity/rn-push';

export default function PushScreen() {
  const [data, { loading, error, refresh }] = usePush();

  if (loading) return <ActivityIndicator />;
  if (error) return <Text>{error.message}</Text>;
  if (!data) return null;

  const { client, credentials, pendingNotifications, allNotifications } = data;

  // Enroll
  await client.addCredentialFromUri(uri);

  // Approve / deny
  await client.approveNotification(notification.id);
  await client.denyNotification(notification.id);
  await client.approveChallengeNotification(notification.id, selectedNumber);

  await refresh(); // re-fetch after any mutation
}
```

**Listen for incoming notifications:**

```tsx
useEffect(() => {
  if (!data) return;
  return data.client.onNotification((notification) => {
    if (notification) {
      /* show approval UI */
    }
  });
}, [data]);
```

### PushClient method reference

All methods return a `Promise` and reject with `PushError` on failure.

**Credentials**

| Method                      | Description                                                        |
| --------------------------- | ------------------------------------------------------------------ |
| `addCredentialFromUri(uri)` | Enroll from a `pushauth://` URI. Returns the new `PushCredential`. |
| `getCredentials()`          | Return all enrolled `PushCredential[]`.                            |
| `getCredential(id)`         | Return a single `PushCredential` by id.                            |
| `deleteCredential(id)`      | Remove an enrolled account.                                        |

**Notifications**

| Method                                     | Description                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `getPendingNotifications()`                | Return `PushNotification[]` awaiting a response.                                                                                |
| `getAllNotifications()`                    | Return the full notification history.                                                                                           |
| `getNotification(id)`                      | Return a single notification by id.                                                                                             |
| `approveNotification(id)`                  | Approve a `default`-type notification.                                                                                          |
| `denyNotification(id)`                     | Deny any notification.                                                                                                          |
| `approveChallengeNotification(id, answer)` | Approve a `challenge`-type notification with the selected number. Use `getNumbersChallenge(notification)` to parse the options. |
| `approveBiometricNotification(id, method)` | Approve a `biometric`-type notification after the biometric prompt.                                                             |
| `cleanupNotifications(credentialId?)`      | Run the configured cleanup strategy; optionally scoped to one credential. Returns the count removed.                            |

**Token and lifecycle**

| Method                        | Description                                                           |
| ----------------------------- | --------------------------------------------------------------------- |
| `getDeviceToken()`            | Return the current FCM/APNs token, or `null` if not yet registered.   |
| `refreshToken()`              | (Android only) Request a new FCM token from the OS.                   |
| `onNotification(callback)`    | Subscribe to incoming push messages. Returns an unsubscribe function. |
| `onTokenRegistered(callback)` | Subscribe to device token updates. Returns an unsubscribe function.   |
| `close()`                     | Release native resources and remove all subscriptions.                |

**Helpers**

| Function                            | Description                                                         |
| ----------------------------------- | ------------------------------------------------------------------- |
| `getNumbersChallenge(notification)` | Parse the comma-separated `numbersChallenge` field into `number[]`. |

## Logging integration (optional)

```ts
import { createPushClient } from '@ping-identity/rn-push';
import { logger } from '@ping-identity/rn-logger';

const client = await createPushClient({
  logger: logger({ level: 'debug' }),
});
```

## Push storage (optional)

By default, push credentials and notifications are stored in a platform-default location. Pass a custom storage handle (created by `configurePushStorage` from `@ping-identity/rn-storage`) to isolate storage per app or configuration.

```ts
import { createPushClient } from '@ping-identity/rn-push';
import { configurePushStorage } from '@ping-identity/rn-storage';

const client = await createPushClient({
  storage: configurePushStorage({
    android: {
      keyAlias: 'push_key',
      fileName: 'push_db',
      strongBoxPreferred: true,
    },
    ios: {
      account: 'com.example.push',
      encryptor: true,
    },
  }),
});
```

## Customisation

### Android tray notifications

Tray notification text, channel name, colour, and icon are defined in your app's own resource
files — the SDK does not ship default strings or colors for these. See `PushMessagingService` in
the sample app for a working example.

---

## Error handling

All methods reject with a `PushError` instance, which extends `PingError` (from `@ping-identity/rn-types`), which extends `Error`.
Use `instanceof` to narrow the type:

```ts
import { PushError } from '@ping-identity/rn-push';
import type { PingError } from '@ping-identity/rn-types'; // base type if needed

try {
  await client.addCredentialFromUri(uri);
} catch (err) {
  if (err instanceof PushError) {
    console.log(err.code); // PushErrorCode string — use for programmatic handling
    console.log(err.type); // error category string from native layer
    console.log(err.message); // human-readable description
    console.log(err.status); // HTTP status code if applicable, otherwise undefined
  }
}
```

| Code                       | Meaning                                               |
| -------------------------- | ----------------------------------------------------- |
| `'invalid_uri'`            | Not a valid `pushauth://` URI.                        |
| `'duplicate_credential'`   | A credential with the same identifier already exists. |
| `'registration_failed'`    | Device registration with the push service failed.     |
| `'notification_not_found'` | Notification does not exist or has expired.           |
| `'device_token_not_set'`   | No device token registered.                           |
| `'network_failure'`        | Network error communicating with the push service.    |
| `'storage_failure'`        | Credential or notification storage operation failed.  |
| `'not_initialized'`        | Client was not initialized before calling a method.   |

See `PushErrorCode` in the package types for the full list.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details

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
  - [Scenario A — No existing push integration](#scenario-a--no-existing-push-integration)
- [How to use the SDK](#how-to-use-the-sdk)
  - [React hook — recommended](#react-hook--recommended)
  - [PushClient method reference](#pushclient-method-reference)
- [Logging integration](#logging-integration-optional)
- [Push storage](#push-storage-optional)
- [Customisation](#customisation)
- [Advanced configuration](#advanced-configuration)
  - [Scenario B — Using a React Native JS push library](#scenario-b--using-a-react-native-js-push-library)
  - [Scenario C — Already using another native push provider](#scenario-c--already-using-another-native-push-provider)
- [Error handling](#error-handling)
- [License](#license)

## Installation

```bash
yarn add @ping-identity/rn-push
cd ios && pod install
```

Optional integration packages:

```bash
yarn add @ping-identity/rn-logger
yarn add @ping-identity/rn-storage
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

The SDK needs to receive the platform push token and incoming messages. If you already have push infrastructure in your app, see [Advanced configuration](#advanced-configuration).

### Scenario A — No existing push integration

**Android** — declare the service in `AndroidManifest.xml` and initialise in `Application.onCreate()`:

```xml
<service android:name="com.pingidentity.rnpush.RNPingPushMessagingService"
         android:exported="false">
  <intent-filter>
    <action android:name="com.google.firebase.MESSAGING_EVENT" />
  </intent-filter>
</service>
```

```kotlin
import com.google.firebase.FirebaseApp
import com.pingidentity.rnpush.RNPingPushMessagingService

override fun onCreate() {
    super.onCreate()
    FirebaseApp.initializeApp(this)
    RNPingPushMessagingService.ensureNotificationChannel(this)
    // ... rest of your Application.onCreate() ...
}
```

**iOS** — extend `RNPingPushApplicationDelegate` and call `requestPushAuthorization`:

```swift
import UIKit
import React_RCTAppDelegate  // or your existing React Native import
import RNPingPush

@main
class AppDelegate: RNPingPushApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // ... React Native factory setup ...
    requestPushAuthorization(application: application)
    return true
  }
}
```

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

Override any of these resources in your app to match your branding:

| Resource                        | Type     | Default                                        | Notes                                                       |
| ------------------------------- | -------- | ---------------------------------------------- | ----------------------------------------------------------- |
| `ping_push_notification_title`  | string   | `"Authentication Request"`                     | Tray notification title                                     |
| `ping_push_notification_body`   | string   | `"You have a new authentication request"`      | Fallback body; replaced by server message text when present |
| `ping_push_channel_name`        | string   | `"Push Authentication"`                        | Shown in Android Settings                                   |
| `ping_push_channel_description` | string   | `"Ping Identity push authentication requests"` | Shown in Android Settings                                   |
| `ping_push_notification_color`  | color    | `#4B6CF5`                                      | Notification icon accent color                              |
| `ping_push_notification_icon`   | drawable | System info icon                               | Monochrome (white-on-transparent) vector or PNG             |

### iOS foreground presentation

If you are using `RNPingPushApplicationDelegate` (basic setup), set `foregroundPresentationOptions` in `didFinishLaunchingWithOptions` to control banner/sound/badge when the app is foregrounded. Default is `[.banner, .sound, .badge]`:

```swift
foregroundPresentationOptions = [.sound]  // or [] to suppress entirely
requestPushAuthorization(application: application)
```

For per-notification control, override `userNotificationCenter(_:willPresent:withCompletionHandler:)` directly.

---

## Advanced configuration

Use these scenarios if you already have push infrastructure in your app and need to integrate alongside it.

### Scenario B — Using a React Native JS push library

No native code changes needed. The examples below use `@react-native-firebase/messaging` and `@notifee/react-native` — adapt to your library as needed.

Ping sends **data-only FCM messages** (no `notification` field), which means the Firebase background handler fires correctly on Android even when the app is killed.

**`index.js` — background/quit handler, registered at the top level before `AppRegistry`:**

```ts
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { createPushClient } from '@ping-identity/rn-push';

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  const pushClient = await createPushClient();
  const notification = await pushClient.processNotification(remoteMessage.data);
  if (notification) {
    // Post a tray notification — no notification field in the FCM payload means
    // nothing is shown automatically, so we post one here via Notifee.
    const channelId = await notifee.createChannel({
      id: 'ping_push',
      name: 'Authentication',
      importance: AndroidImportance.HIGH,
    });
    await notifee.displayNotification({
      title: 'Authentication Request',
      body: notification.messageText ?? 'You have a new authentication request',
      android: { channelId, pressAction: { id: 'default' } },
    });
  }
});
```

**App setup — token wiring, foreground handler, and cold-start tap:**

```ts
const pushClient = await createPushClient();

// Seed the token on startup and keep it fresh
const token = await messaging().getToken();
await pushClient.setDeviceToken(token);
messaging().onTokenRefresh((token) => {
  void pushClient.setDeviceToken(token);
});

// Foreground messages
messaging().onMessage(async (remoteMessage) => {
  // Use processNotification() if your library gives you a key-value data map.
  // Use processNotificationFromMessage() if it gives you a raw string payload.
  const notification = await pushClient.processNotification(remoteMessage.data);
  if (notification) {
    /* show approve/deny UI */
  }
});

// Cold-start tap: app was killed and user tapped the tray notification.
messaging()
  .getInitialNotification()
  .then(async (remoteMessage) => {
    if (remoteMessage) {
      await pushClient.processNotification(remoteMessage.data);
    }
  });
```

### Scenario C — Already using another native push provider

**Android** — add two lines to your existing `FirebaseMessagingService`:

```kotlin
override fun onNewToken(token: String) {
    existingSdk.updateToken(token)
    RNPingPushCommon.emitEvent(RNPingPushEvents.FCM_TOKEN_RECEIVED, token) // ← add
}

override fun onMessageReceived(remoteMessage: RemoteMessage) {
    existingSdk.handleMessage(remoteMessage)
    val params = Arguments.createMap()
    remoteMessage.data.forEach { (k, v) -> params.putString(k, v) }
    RNPingPushCommon.emitEvent(RNPingPushEvents.PUSH_MESSAGE_RECEIVED, params) // ← add
}
```

**iOS** — add to your existing `AppDelegate`. Set `UNUserNotificationCenter.current().delegate = self` in `didFinishLaunchingWithOptions` if not already set, then add:

```swift
func application(_ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    existingSdk.register(deviceToken)
    // APNs delivers the token as raw Data — convert to hex string before forwarding
    let token = deviceToken.map { String(format: "%02x", $0) }.joined()
    NotificationCenter.default.post(name: .pingAPNsToken, object: nil, userInfo: ["token": token]) // ← add
}

func application(_ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    existingSdk.handleNotification(userInfo)
    NotificationCenter.default.post(name: .pingRemoteNotification, object: nil,
        userInfo: userInfo as? [String: Any] ?? [:]) // ← add
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
    NotificationCenter.default.post(name: .pingRemoteNotification, object: nil,
        userInfo: userInfo as? [String: Any] ?? [:])
    completionHandler()
}
```

**Android — tray notification text**

If you want to post a tray notification when the app is backgrounded, use `RNPingPushMessagingService.extractNotificationText` to decode the message body from the JWT without reimplementing the logic yourself:

```kotlin
override fun onMessageReceived(remoteMessage: RemoteMessage) {
    existingSdk.handleMessage(remoteMessage)
    val params = Arguments.createMap()
    remoteMessage.data.forEach { (k, v) -> params.putString(k, v) }
    RNPingPushCommon.emitEvent(RNPingPushEvents.PUSH_MESSAGE_RECEIVED, params)

    if (!isAppInForeground()) {
        val (title, body) = RNPingPushMessagingService.extractNotificationText(
            remoteMessage.data,
            getString(R.string.ping_push_notification_title),
            getString(R.string.ping_push_notification_body),
        )
        // post your tray notification using title and body
    }
}
```

---

## Error handling

All methods reject with `PushError`, which extends the shared `GenericError` from `@ping-identity/rn-types`.

```ts
try {
  await client.addCredentialFromUri(uri);
} catch (error) {
  const e = error as PushError;
  console.log(e.type, e.error, e.message);
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

MIT

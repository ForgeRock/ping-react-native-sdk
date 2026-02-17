<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Device Profile

The Device Profile module provides a structured framework for collecting device information in
React Native applications. It uses a modular collector system that makes it easy to gather,
extend, and customize the device data you need, with native Android and iOS collectors handling
collection, permissions, and payload formatting.

## Table of contents

- [Overview](#overview)
- [Getting started](#getting-started)
- [Built-in collectors](#built-in-collectors)
- [Android setup](#android-setup)
- [Journey integration](#journey-integration)
- [API reference](#api-reference)
- [Errors](#errors)

## Overview

This module provides two collection paths:

- `collectDeviceProfile` for generic device profile collection.
- `collectDeviceProfileForJourney` for PingOne AIC Journey flows.

Output is JSON-compatible. The exact fields are platform-defined and may vary based on
collector support, permissions, and device capabilities.

## Getting started

### Install

```sh
npm install @ping-identity/rn-device-profile
```

If you use CocoaPods, install pods after adding the package:

```sh
cd ios && pod install
```

### Basic usage (outside Journey)

```ts
import { collectDeviceProfile } from '@ping-identity/rn-device-profile';

const profile = await collectDeviceProfile(['platform', 'hardware', 'network']);
```

### Example output (all collectors)

```json
{
  "platform": {
    "platform": "android",
    "device": "flame",
    "deviceName": "Pixel 4",
    "model": "Pixel 4",
    "brand": "google",
    "locale": "en_US",
    "timeZone": "America/Vancouver"
  },
  "hardware": {
    "hardware": "flame",
    "manufacturer": "Google",
    "storage": 64,
    "memory": 6144,
    "cpu": 8,
    "display": {
      "width": 1080,
      "height": 2280
    },
    "camera": {
      "noOfCameras": 2
    }
  },
  "network": {
    "connected": true
  },
  "telephony": {
    "networkCountryIso": "US",
    "carrierName": "Verizon"
  },
  "bluetooth": {
    "supported": true
  },
  "browser": {
    "userAgent": "Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Mobile Safari/537.36"
  },
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194
  }
}
```

## Built-in collectors

Availability depends on platform and permissions.

- `platform`: device and OS metadata.
- `hardware`: hardware and capability details.
- `network`: connection status and network properties.
- `telephony`: carrier and telephony metadata.
- `browser`: default browser user agent details.
- `bluetooth`: Bluetooth support status.
- `location`: location coordinates (requires permissions; Android needs Play Services Location).

## Android setup

### Permissions 

The module respects Android's permission model. Some collectors require
permissions declared in `AndroidManifest.xml`.

```xml
<!-- Required for NetworkCollector -->
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Optional: For LocationCollector (will prompt user automatically) -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Note: LocationCollector handles permission requests automatically -->
```

### Google Play Services

`LocationCollector` depends on Google Play Services Location. The native module
checks for this dependency at runtime and rejects location collection if it is
missing. If your app includes location collection, add the dependency at the
app level (not in the library):

```groovy
dependencies {
  implementation "com.google.android.gms:play-services-location:21.3.0"
}
```

If you use a different version across your app, keep it consistent with the
rest of your Play Services dependencies.

### Android setup checklist

1. Add the required permissions to `AndroidManifest.xml`.
2. Add `play-services-location` to your app if you use the `location` collector.
3. Rebuild the app after updating Gradle dependencies.

## iOS setup

If you use the `location` collector, add a location usage description to your
app's `Info.plist` so iOS can prompt the user for permission.

```xml
<!-- Required for LocationCollector -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app uses your location to complete device profiling.</string>

<!-- Optional: use if you need background location access -->
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app uses your location to complete device profiling.</string>
```

## Journey integration

```ts
import { collectDeviceProfileForJourney } from '@ping-identity/rn-device-profile';

const result = await collectDeviceProfileForJourney(
  journey,
  ['platform', 'hardware', 'network', 'location']
);

if (result.type === 'success') {
  await journey.next();
} else {
  console.error('Device profile submission failed', result.code, result.message);
  // Handle failure before advancing the Journey.
}
```

Note: `collectDeviceProfileForJourney` is only valid when a Device Profile callback
is active in the current Journey node. The native implementation resolves the
active callback, applies server-driven configuration, executes the requested
collectors, submits the resulting metadata automatically, and resolves with a
result object describing success or failure.

## API reference

```ts
import type {
  DeviceProfile,
  DeviceProfileCollector,
  DeviceProfileJourneyResult,
} from '@ping-identity/rn-device-profile';
import type { JourneyInstance } from '@ping-identity/rn-types';

function collectDeviceProfile(
  collectors: DeviceProfileCollector[]
): Promise<DeviceProfile>;

function collectDeviceProfileForJourney(
  journey: JourneyInstance,
  collectors: DeviceProfileCollector[]
): Promise<DeviceProfileJourneyResult>;
```

## Errors 
<!-- TODO: needs update after adding error shape -->

Common error codes surfaced via the `error` result when `collectDeviceProfileForJourney`
returns `{ type: 'error', code, message }`:

- `DEVICE_PROFILE_LOCATION_UNAVAILABLE`: Google Play Services Location is missing.
- `DEVICE_PROFILE_CALLBACK_NOT_FOUND`: No active Device Profile callback for the Journey.
- `DEVICE_PROFILE_COLLECT_ERROR`: Collection failed unexpectedly.

## License

MIT

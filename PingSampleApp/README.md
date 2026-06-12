<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Sample App

A reference application for the Ping Identity React Native SDK. It demonstrates
Journey authentication, OIDC authorization, device management, FIDO/WebAuthn,
device binding, external IdP login, and token/session inspection — all wired
together with the SDK's native-backed modules.

## Prerequisites

- [React Native 0.80.1](https://reactnative.dev/docs/0.80/set-up-your-environment) environment set up (Node, Xcode, Android Studio)
- Ruby + Bundler (iOS only)
- A Ping Identity server (ForgeRock/PingAM or PingOne/PingAdvancedIdentityCloud)

## Step 1: Configure your environment

Copy the example env file and fill in your server details:

```sh
cp .env.example .env
```

Edit `.env` with your values:

```sh
# Journey / PingAM
JOURNEY_SERVER_URL=https://openam.example.com/am
JOURNEY_REALM=alpha
JOURNEY_COOKIE=iPlanetDirectoryPro
JOURNEY_CLIENT_ID=my-client-id
JOURNEY_DISCOVERY_ENDPOINT=https://openam.example.com/am/oauth2/alpha/.well-known/openid-configuration
JOURNEY_REDIRECT_URI=com.example.app://oauth2redirect
JOURNEY_SCOPES=openid,profile,email

# PingAdvancedIdentityCloud (optional second profile)
AIC_SERVER_URL=...

# PingOne OIDC (optional)
PINGONE_CLIENT_ID=...
PINGONE_DISCOVERY_ENDPOINT=...
PINGONE_REDIRECT_URI=...
```

See `.env.example` for the full list of supported keys including external IdP
(Facebook, Google) configuration.

> The app is rebuilt with the new values each time you run `yarn ios` or
> `yarn android` — no runtime config UI is needed.

## Step 2: Install dependencies

This project is part of a Yarn workspace. Run the following from the **repo
root** (not from `PingSampleApp/`) — this installs all workspace dependencies
and builds the SDK packages the sample app links against:

```sh
# from repo root
yarn install
yarn packages:build
```

### iOS — install CocoaPods

The first time, or after any native dependency changes, run from `PingSampleApp/`:

```sh
cd PingSampleApp
yarn clean-install
```

This installs Bundler dependencies, CocoaPods, and cleans stale build artifacts in one step.

### Android — keystore setup

The debug build requires a keystore. Generate your own from the **repo root**:

```sh
keytool -genkeypair -v \
  -keystore PingSampleApp/android/app/pingsampleapp-debug.jks \
  -alias androiddebugkey \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass <your-password> -keypass <your-password> \
  -dname "CN=Android Debug,O=Android,C=US"
```

Then add your credentials to your **global** Gradle properties file (`~/.gradle/gradle.properties`):

```properties
KEYSTORE_PASSWORD=<your-password>
KEY_PASSWORD=<your-password>
```

## Step 3: Start Metro

```sh
cd PingSampleApp
yarn start
```

## Step 4: Run the app

Open a second terminal from the `PingSampleApp` directory.

### iOS

```sh
yarn ios
```

### Android

```sh
yarn android
```

If Gradle sync fails in Android Studio with a missing `node` error, launch
Android Studio from a terminal that has Node on PATH:

```sh
open -a "Android Studio"
```

## What the sample app demonstrates

| Screen                   | SDK modules used                                                              |
| ------------------------ | ----------------------------------------------------------------------------- |
| Journey (Full)           | `rn-journey`, `rn-binding`, `rn-fido`, `rn-external-idp`, `rn-device-profile` |
| Journey (Form / Minimal) | `rn-journey`                                                                  |
| OIDC                     | `rn-oidc`, `rn-browser`                                                       |
| Token                    | `rn-oidc`                                                                     |
| User Profile             | `rn-oidc`                                                                     |
| Logout                   | `rn-oidc`, `rn-journey`                                                       |
| Devices                  | `rn-device-client`                                                            |
| Device Profile           | `rn-device-profile`                                                           |
| Binding Keys             | `rn-binding`                                                                  |
| Browser                  | `rn-browser`                                                                  |
| Storage                  | `rn-storage`                                                                  |
| Logger                   | `rn-logger`                                                                   |

Use the **Configuration** screen (gear icon) to switch between the Journey,
PingAdvancedIdentityCloud, and PingOne profiles configured in your `.env`.

## Troubleshooting

- **`react-native: command not found`** — run `yarn install` from the repo root first; the CLI is a workspace dependency, not a global install.
- **`DidYouMean::SPELL_CHECKERS` / old Bundler** — run `gem update bundler` then retry `yarn clean-install`.
- **Android build fails with keystore error** — ensure `pingsampleapp-debug.jks` exists at `PingSampleApp/android/app/` and that `KEYSTORE_PASSWORD`/`KEY_PASSWORD` in `~/.gradle/gradle.properties` match the password used when generating it.
- **Android Gradle missing node** — open Android Studio from a terminal with Node on PATH: `open -a "Android Studio"`.
- **Metro cache issues** — run `yarn start --reset-cache`.
- **iOS build errors after dependency changes** — re-run `bundle exec pod install --project-directory=ios`.
- **Redirect URI mismatch** — ensure `JOURNEY_REDIRECT_URI` / `PINGONE_REDIRECT_URI` in `.env` matches the redirect scheme registered in your server and in `android/app/build.gradle` (`appRedirectUriScheme`).

For general React Native 0.80.0 issues see the [Troubleshooting guide](https://reactnative.dev/docs/0.80/troubleshooting).

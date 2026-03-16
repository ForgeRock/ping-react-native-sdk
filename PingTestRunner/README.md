# PingTestRunner

Standalone React Native test-runner app for automated integration and E2E testing of the Ping Identity React Native SDK packages.

This app is **not** a demo or sample app. It is a minimal, dependency-light host designed for CI pipelines and local developer testing. All sample/demo UI lives in `PingSampleApp`.

---

## Overview

| Layer | Tool | Location |
|---|---|---|
| JS unit tests (per package) | Jest | `packages/*/src/__tests__/` |
| Integration tests | Jest (node env, native mocked) | `__tests__/integration/` |
| Android native unit tests | Kotlin/JUnit/Robolectric via Gradle | `packages/*/android/src/test/` |
| iOS native unit tests | Swift/XCTest via CocoaPods test_spec | `packages/*/ios/Tests/` |
| E2E tests | Detox | `e2e/` |
| Android build | Gradle + React Native | `android/` |
| iOS build | CocoaPods + React Native | `ios/` |

### Packages under test

| Package | Integration test file |
|---|---|
| `@ping-identity/rn-browser` | `browser.test.ts` |
| `@ping-identity/rn-core` | `core.test.ts` |
| `@ping-identity/rn-device-id` | `device-id.test.ts` |
| `@ping-identity/rn-device-profile` | `device-profile.test.ts` |
| `@ping-identity/rn-journey` | `journey.test.ts` |
| `@ping-identity/rn-logger` | `logger.test.ts` |
| `@ping-identity/rn-oidc` | `oidc.test.ts` |
| `@ping-identity/rn-storage` | `storage.test.ts` |
| `@ping-identity/rn-types` | `types.test.ts` |

---

## Prerequisites

- Node 20 (see `.nvmrc` at the repo root)
- Yarn 4 (`corepack enable`)
- For Android E2E: Android SDK 34+, an AVD named `Pixel_7_API_34`
- For iOS E2E: Xcode 16+, an iPhone 16 simulator

---

## Setup

### 1. Install dependencies

From the **monorepo root**:

```bash
yarn install
yarn packages:build
```

### 2. iOS — install CocoaPods

```bash
cd PingTestRunner
yarn clean-install
# or manually:
cd ios && bundle install && bundle exec pod install --repo-update && cd ..
```

### 3. Android — generate a debug keystore (first time only)

```bash
cd PingTestRunner/android/app
keytool -genkey -v -keystore debug.keystore -storepass android \
  -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000
```

---

## Running tests

All test commands run entirely in Node — no device or simulator required.

### Integration tests only (what `turbo run test` calls)

```bash
# From PingTestRunner directory
yarn test

# From monorepo root
yarn test:runner
```

### All unit tests + integration tests in one pass

```bash
# From PingTestRunner directory
yarn test:all

# With combined coverage report
yarn test:all:coverage

# From monorepo root
yarn test:runner:all
yarn test:runner:all:coverage
```

`test:all` uses Jest `projects` to run the unit tests of every package
(`browser`, `device-id`, `device-profile`, `journey`, `logger`, `oidc`,
`storage`) together with the PingTestRunner integration tests in a single
Jest invocation. Each package's own `jest.config.js` is used, so its
mocks, setup files, and `transformIgnorePatterns` are preserved exactly.

### Integration tests (explicit)

```bash
yarn test:integration
yarn test:integration:coverage
```

---

## Running native unit tests

Native tests (Kotlin/JUnit on Android, Swift/XCTest on iOS) live inside each
package's `android/src/test/` and `ios/Tests/` directories. PingTestRunner
is the host project that wires them together.

### Android — Kotlin/JUnit/Robolectric

Requires `gradlew` in `PingTestRunner/android/` (copy from PingSampleApp or
generate via `react-native init` — see setup notes in the "Prerequisites"
section). All 8 package library modules are included in `settings.gradle`.

```bash
# From PingTestRunner directory
yarn test:native:android

# From monorepo root
yarn test:runner:native:android
```

This runs `./gradlew :<module>:test` for every package in one Gradle
invocation. Test reports land in
`packages/<pkg>/android/build/reports/tests/`.

### iOS — Swift/XCTest via CocoaPods test_spec

Requires a pod install after which `PingTestRunner.xcworkspace` contains all
test targets. Packages with `ios/Tests/` and a `test_spec` in their podspec:
`core`, `device-id`, `journey`, `logger`, `oidc`, `storage`.

```bash
# After pod install:
yarn test:native:ios

# From monorepo root
yarn test:runner:native:ios
```

This calls `xcodebuild test` targeting each package's `Tests` spec. Pipe
output through `xcpretty` for a readable summary (install with
`gem install xcpretty`).

## Running E2E tests (Detox)

### iOS

```bash
# 1. Build the test app
yarn build:e2e:ios

# 2. Run the suite
yarn test:e2e:ios
```

### Android

```bash
# 1. Start the Metro bundler
yarn start &

# 2. Build the test APK
yarn build:e2e:android

# 3. Run the suite
yarn test:e2e:android
```

### Release builds

```bash
yarn test:e2e:ios:release
yarn test:e2e:android:release
```

---

## Required environment variables

Integration tests mock all native modules and **do not** require any environment variables.

E2E tests that exercise live authentication flows are **self-skipping** when env vars are absent — the app-launch smoke tests still run. To enable live auth flows set the following before running Detox:

| Variable | Description | Example |
|---|---|---|
| `PING_DISCOVERY_ENDPOINT` | OIDC discovery URL | `https://openam.example.com/openam/.well-known/openid-configuration` |
| `PING_CLIENT_ID` | OAuth2 client ID | `my-rn-client` |
| `PING_REDIRECT_URI` | Redirect URI (must be registered on server) | `org.forgerock.demo://oauth2redirect` |
| `PING_SERVER_URL` | PingAM base URL | `https://openam.example.com/openam` |
| `PING_REALM_PATH` | Realm path | `/alpha` |
| `PING_JOURNEY_NAME` | Auth tree / journey name | `Login` |
| `PING_TEST_USERNAME` | Test user login | `testuser@example.com` |
| `PING_TEST_PASSWORD` | Test user password | *(store in CI secrets)* |

You can export these from a local file (not committed):

```bash
# .env.e2e (git-ignored)
export PING_DISCOVERY_ENDPOINT=https://...
export PING_CLIENT_ID=my-rn-client
# ... etc

source .env.e2e
yarn test:e2e:ios
```

---

## CI integration

Add the following steps to your pipeline (example for GitHub Actions):

```yaml
- name: Install dependencies
  run: yarn install && yarn packages:build

- name: Run integration tests
  run: yarn workspace PingTestRunner test:integration

- name: Build E2E app (iOS)
  run: yarn workspace PingTestRunner build:e2e:ios

- name: Run E2E tests (iOS)
  env:
    PING_DISCOVERY_ENDPOINT: ${{ secrets.PING_DISCOVERY_ENDPOINT }}
    PING_CLIENT_ID: ${{ secrets.PING_CLIENT_ID }}
    PING_SERVER_URL: ${{ secrets.PING_SERVER_URL }}
    PING_REALM_PATH: ${{ secrets.PING_REALM_PATH }}
    PING_JOURNEY_NAME: ${{ secrets.PING_JOURNEY_NAME }}
    PING_TEST_USERNAME: ${{ secrets.PING_TEST_USERNAME }}
    PING_TEST_PASSWORD: ${{ secrets.PING_TEST_PASSWORD }}
  run: yarn workspace PingTestRunner test:e2e:ios
```

---

## Project structure

```
PingTestRunner/
├── App.tsx                        # Minimal host app (no demo UI)
├── index.js                       # RN entry point
├── app.json                       # App name config
├── package.json                   # Workspace package
├── metro.config.js                # Metro with monorepo package resolution
├── babel.config.js
├── tsconfig.json
├── jest.config.js                 # Integration test Jest config
├── jest.setup.js                  # Global native module mocks
├── .detoxrc.js                    # Detox E2E config
│
├── __tests__/
│   └── integration/               # Jest integration tests (one per package)
│       ├── browser.test.ts
│       ├── core.test.ts
│       ├── device-id.test.ts
│       ├── device-profile.test.ts
│       ├── journey.test.ts
│       ├── logger.test.ts
│       ├── oidc.test.ts
│       ├── storage.test.ts
│       └── types.test.ts
│
├── e2e/                           # Detox E2E tests
│   ├── jest.config.js
│   ├── setup.ts                   # Shared helpers + env resolution
│   ├── app-launch.test.ts         # Smoke test (always runs)
│   ├── oidc-happy-path.test.ts    # OIDC auth + failure paths
│   └── journey-happy-path.test.ts # Journey auth + failure paths
│
├── android/                       # Android native project
│   ├── build.gradle
│   ├── settings.gradle
│   ├── gradle.properties
│   └── app/
│       ├── build.gradle
│       ├── proguard-rules.pro
│       └── src/main/
│           ├── AndroidManifest.xml
│           ├── java/com/pingtestrunner/
│           │   ├── MainActivity.kt
│           │   └── MainApplication.kt
│           └── res/values/
│               ├── strings.xml
│               └── styles.xml
│
└── ios/                           # iOS native project
    ├── Podfile
    └── PingTestRunner/
        └── Info.plist
```

---

## Adding new tests

### Integration test

1. Create `__tests__/integration/<package-name>.test.ts`
2. Add the native module mock to `jest.setup.js`
3. Add a `moduleNameMapper` entry to `jest.config.js` if the package is new

### E2E test

1. Create `e2e/<feature>.test.ts`
2. Import helpers from `e2e/setup.ts`
3. Guard live-server assertions with `hasLiveAuthEnv()` so CI passes without credentials

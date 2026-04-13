<!--
Copyright (c) 2025 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

[![Ping Identity][ping-image]][repo-url]
[![License][license-image]][license-url]
[![Yarn][yarn-image]][yarn-url]
# React Native Ping SDK

This repository demonstrates the **Ping Identity React Native SDK** — a modular setup where native SDKs (Storage, OIDC, Browser, Journey, etc.) are wrapped as independent TurboModules and integrated into a sample React Native app.

Please visit our [ documentation ](https://docs.pingidentity.com/sdks/latest/sdks/index.html) site for more information.

---

## Getting Started

### Requirements

This monorepo targets React Native `0.80.1` as the plug-and-play baseline version.

The SDK supports both React Native New Architecture (the sample app runs with `RCT_NEW_ARCH_ENABLED=1`) and the legacy bridge architecture.

### Platform compatibility

| Platform | Minimum version |
| -------- | :---------: |
| iOS      |    16.0     |
| Android  |   API 29+   |

### Android build settings

The repository packages use:

- `compileSdkVersion`: `36`
- `targetSdkVersion`: `36`
- `minSdkVersion`: `29`
- `kotlinVersion`: `2.2.10` (package default)

### iOS deployment target

Set your iOS deployment target to `16.0` in your app Podfile:

```ruby
platform :ios, '16.0'
```

---

## Setup: Prepare Packages

Install all workspace dependencies and rebuild SDK packages:

```bash
yarn packages:install
yarn packages:build
```

This ensures all local modules under `packages/*` are properly bootstrapped before running the sample app.

---

## Run the Sample App

### **Android**

```bash
yarn sample:clean-install
yarn sample:run:android
```

### **iOS**

```bash
yarn sample:clean-install
yarn sample:run:ios
```

---

## Notes

* `sample:clean-install` clears and reinstalls dependencies inside the sample app (`PingSampleApp`).
* TODO(testing): remove the temporary `react-test-renderer` deprecation-warning suppression in `packages/journey/jest.setup.js` once `@testing-library/react-native` no longer depends on it.

---

## Monorepo Structure

```
react-native-pingidentity/
├── packages/
│   ├── storage/
│   ├── oidc/
│   ├── browser/
│   └── journey/
└── PingSampleApp/
```

Each package is published independently and can be consumed as a standalone NPM module, or tested together using the sample app.

---

## Feedback

### Contributing

We welcome contributions to the React Native Ping SDK! Please read the guidelines on how to contribute, including development workflow and best practices:

- [Development workflow and contribution guidelines](./CONTRIBUTING.md)
- [Community guidelines and standards](./CODE_OF_CONDUCT.md)

---

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details

<!-- Variables -->
[ping-image]: https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg
[repo-url]: https://github.com/ForgeRock/ping-react-native-sdk
[license-image]: https://img.shields.io/badge/license-MIT-green.svg
[license-url]: ./LICENSE
[yarn-image]: https://img.shields.io/badge/yarn-4.11.0-2C8EBB?logo=yarn&logoColor=white
[yarn-url]: https://yarnpkg.com/

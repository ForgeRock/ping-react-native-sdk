[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native Core

The Core module provides shared runtime infrastructure required by all other Ping Identity React Native SDK packages. It does not expose a consumer API — install it once and the other packages handle the rest.

## Installation

All other Ping Identity RN SDK packages depend on this module. Install it first:

```bash
yarn add @ping-identity/rn-core
cd ios && pod install
```

### Android build requirements

> **Note:** Building this package on Android requires JDK 21 and Kotlin 2.2 or later. The Ping
> Android SDK artifacts are compiled to Java 21 bytecode, so modules that compile against them must
> also use a JVM target of 21. The React Native Gradle plugin aligns Android modules to JVM 17, so
> set `react.internal.disableJavaVersionAlignment=true` in your app's `android/gradle.properties` to
> let the JVM 21 target apply.

See the [Android build requirements](https://github.com/ForgeRock/ping-react-native-sdk#android-build-requirements) section in the repository README for optional settings and framework support.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details

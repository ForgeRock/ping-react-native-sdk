# iOS delivery of PingRecognize through CocoaPods

Proof-of-concept notes. Facts were read from `ForgeRock/ping-ios-sdk` tag `2.2.0` and from `ping-internal/kl_sdk_react_native` tag `6.0.0`.

## Problem

- `PingRecognize` is in the `2.2.0` tag (`Recognize/Recognize/**`) but has no podspec. It was removed in SDKS-5454, before the tag.
- Upstream ships it through SwiftPM only. The manifest exports the library only when a private Keyless registry is configured.
- This repository consumes native iOS code through CocoaPods only.

## Route

1. `ios/vendor/PingRecognize.podspec` recreates the podspec. It points at the git tag `2.2.0`, compiles `Recognize/Recognize/**/*.swift`, keeps the module name `PingRecognize`, and depends on `PingJourneyPlugin ~> 2.2.0` and the pod `keyless-mobile-sdk` `6.0.0`.
2. `RNPingRecognize.podspec` depends on `PingRecognize 2.2.0`. The host Podfile satisfies that dependency with `pod 'PingRecognize', :podspec => '.../vendor/PingRecognize.podspec'`.
3. Keyless is a CocoaPods source on Cloudsmith: `https://dl.cloudsmith.io/<token>/keyless/partners/cocoapods/index.git`. The sample Podfile builds the URL from the `CLOUDSMITH_TOKEN_RECOGNIZE` environment variable and never stores a token.

## Findings

- The Keyless pod name `keyless-mobile-sdk` and its pin `= 6.0.0` come from the Keyless RN podspec `KeylessSDK-RN`. That package's Swift sources use `import KeylessSDK`, so the pod's module is `KeylessSDK`. This is the module name `PingRecognize` imports, so `#if canImport(KeylessSDK)` should evaluate true once the pod is a dependency.
- The Keyless RN package depends on the same pod at the same version, so both options can coexist.
- `Journey.swift` finds `PingRecognize.RecognizeCallbacks` by class name. The pod must keep the module name `PingRecognize`.
- Callbacks are not `@MainActor`. The native README requires an active view controller on the main thread, so the bridge starts the ceremony from a main-actor `Task`.

## Risks

- With static linkage, `RecognizeCallbacks` is referenced only by name, so the linker could drop it and Journey would not register the Recognize callback. This needs a device check.
- `RecognizeCallbacks` is internal, so the bridge cannot reference it to force linking.
- `rn-recognize` is a sample-app dependency, so autolinking adds `RNPingRecognize` on every `pod install`. Without the Cloudsmith token that install fails. Excluding it needs a `react-native.config.js` entry or a token for every developer.
- The iOS 2.2.0 README still documents `pod 'PingRecognize'`, which no longer exists.

## Not verified (needs the Keyless token)

- `pod install`, because `keyless-mobile-sdk` cannot be resolved without the token.
- Compiling `PingRecognize` and the bridge, including `canImport(KeylessSDK)` and Swift 6 mode under CocoaPods.
- `pod spec lint`, which needs the network and the Keyless source.
- The `.mm` and TurboModule codegen output (`RNPingRecognizeSpec` is generated at build time).
- That `keyless-mobile-sdk` 6.0.0 is on the `partners` Cloudsmith source and not only `partners-rc`.
- Camera and liveness on a real device, the foreground view controller requirement, and `NSCameraUsageDescription` in the host app.

## Verified offline

- `pod ipc spec` evaluates the vendored podspec.
- `ruby -c` passes for `RNPingRecognize.podspec` and the sample `Podfile`.
- `swiftc -parse` passes for the two Swift files.

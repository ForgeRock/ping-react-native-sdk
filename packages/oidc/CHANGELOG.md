# @ping-identity/rn-oidc

## 1.1.0

### Minor Changes

- #### Added
  - New `@ping-identity/rn-protect` module for PingOne Protect fraud prevention, including behavioral data collection and Protect signals in DaVinci flows
  - First public release of the `@ping-identity/rn-davinci` module for DaVinci orchestration with form rendering and submission
  - DaVinci `BooleanCollector` and `ReadOnlyTextCollector` support, plus auto-submit for collectors flagged auto-capable by the flow
  - DaVinci polling and QRCode collectors so flows can wait on out-of-band status and display QR codes
  - DaVinci external IdP (social login) collector support
  - DaVinci support for: phone extension fields (`extension`, `showExtension`, `extensionLabel`) on the phone number collector, `richContent` on the label collector, server-provided validation rules on the password collector, structured password-policy validation errors (`INVALID_LENGTH`, `UNIQUE_CHARACTER`, `MAX_REPEAT`, `MIN_CHARACTERS`) with native constraint values, and a `validate` method for on-demand collector validation
  - Device authorization grant flow in `@ping-identity/rn-oidc` for devices with limited input, via `createOidcDeviceClient` and `useDeviceAuthGrant`
  - Pushed Authorization Request (PAR) support in `@ping-identity/rn-oidc` through the `par` client config option
  - `FidoRegistrationCollector` and `FidoAuthenticationCollector` passkey collectors for DaVinci flows in `@ping-identity/rn-fido`
  - `useJourneyForm` hook with typed, normalized form fields for simpler Journey callback handling in `@ping-identity/rn-journey`
  - Journey `ContinueNode` UI metadata exposure: page header, description, submit button text, and page footer
  - Improved Expo compatibility with config plugin ownership
  - OATH typed errors carry violated policy details, so callers can react without parsing message strings

  #### Fixed
  - `SOCIAL_LOGIN_BUTTON` no longer reported in unsupported fields when an IdP collector is present in `@ping-identity/rn-davinci`

### Patch Changes

- Updated dependencies []:
  - @ping-identity/rn-core@1.1.0
  - @ping-identity/rn-types@1.1.0

## 1.0.0

### Major Changes

- Initial stable release of the Ping Identity React Native SDK.

### Patch Changes

- Updated dependencies
  - @ping-identity/rn-core@1.0.0
  - @ping-identity/rn-types@1.0.0

## 1.0.0-beta.3

### Patch Changes

- fix(core): add RNPingCorePackage for Android autolinking

- Updated dependencies []:
  - @ping-identity/rn-types@1.0.0-beta.3
  - @ping-identity/rn-core@1.0.0-beta.3

## 1.0.0-beta.2

### Patch Changes

- fix(core): add codegenConfig to trigger Android autolinking

- Updated dependencies []:
  - @ping-identity/rn-types@1.0.0-beta.2
  - @ping-identity/rn-core@1.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- fix: move rn-core to peerDependencies and fix workspace:\* refs in published packages

- Updated dependencies []:
  - @ping-identity/rn-types@1.0.0-beta.1
  - @ping-identity/rn-core@1.0.0-beta.1

## 1.0.0-beta.0

### Major Changes

- [`b8341ef`](https://github.com/ForgeRock/ping-react-native-sdk/commit/b8341ef2025aced0ae984529a6643a1de873fd44) Thanks [@pingidentity-gaurav](https://github.com/pingidentity-gaurav)! - Initial 1.0.0 beta release

### Patch Changes

- Updated dependencies [[`b8341ef`](https://github.com/ForgeRock/ping-react-native-sdk/commit/b8341ef2025aced0ae984529a6643a1de873fd44)]:
  - @ping-identity/rn-core@1.0.0-beta.0
  - @ping-identity/rn-types@1.0.0-beta.0

# @ping-identity/rn-davinci

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

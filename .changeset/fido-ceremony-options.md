---
'@ping-identity/rn-fido': minor
---

feat(rn-fido): expose FIDO ceremony customization options (SDKS-5401)

`register` and `authenticate` take an optional second ceremony-options
argument; the Journey and DaVinci methods carry the same fields in their
existing options object:

- `preferImmediatelyAvailableCredentials` on both ceremonies (iOS applies it
  to authentication, Android to registration).
- `android.credentialManager` registration overrides: `requestJson` (JSON
  merge patch), `clientDataHash` (base64url), `origin`,
  `isAutoSelectAllowed`, `isConditional`, `preferDefaultProvider`.
- `android.credentialManager` authentication overrides: `requestJson`,
  `clientDataHash`, `allowedProviders`.
- `android.playServices` authentication overrides: `timeoutSeconds`,
  `requestId`, `transports` (flat list applied to every allow-list entry),
  `authenticationExtensions` (`fidoAppId`, `userVerificationMethod`).

Android authentication takes a per-call `android.useFido2ApiClient` option that
selects the FIDO2 API for `authenticate`, `authenticateForJourney` and
`authenticateForDaVinci`, matching the native Android SDK. The route is the
per-call value, else the client-level `android.useFido2ApiClient`, else native
auto-detection (Play Services when the host app includes `play-services-fido`).
The `android.credentialManager` and `android.playServices` blocks never change
the route: only the block matching the selected route is applied, and a block
that is not applied is logged as a warning. Supplying both blocks is allowed.
The client-level `android.useFido2ApiClient` flag is deprecated in favor of the
per-call flag and remains supported.

The `FidoClientConfig` type remains exported for compatibility with its
original 1.1.0 shape (`loggerId`, `useFido2Client`). It is deprecated: it
describes an internal native payload and no public function accepts or returns
it.

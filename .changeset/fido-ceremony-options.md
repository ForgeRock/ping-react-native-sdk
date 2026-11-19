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

Standalone `authenticate` now rejects with `FIDO_AUTHENTICATE_CANCELLED` on both
platforms when the user cancels or no usable credential is available, matching
`authenticateForJourney` and `authenticateForDaVinci`. Previously standalone
`authenticate` rejected these cases with `FIDO_AUTHENTICATE_ERROR`, so callers
that branch on that code for user dismissal must also handle the new code.
`register` is unchanged and rejects with `FIDO_REGISTER_ERROR`.

`trigger` is now a required `string` on both DaVinci collector types (the raw
server value, `""` when omitted).

The `FidoClientConfig` type is no longer exported. It described the internal
native payload and no public function accepted or returned it, so only code that
imported the type directly is affected. The replacement is internal.

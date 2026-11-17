---
'@ping-identity/rn-external-idp': minor
---

feat(rn-external-idp): add native custom IdpHandler registry for additional social providers (SDKS-5452)

Adds a native-only custom handler registry so apps can support social providers
beyond the built-in apple/siwa/google/facebook set (for example LINE or WeChat).
App code implements the native SDK's `IdpHandler` interface
(`com.pingidentity.idp.IdpHandler` on Android,
`PingExternalIdP.IdpHandler` on iOS) and registers it at startup via
`RNPingExternalIdpCommon.registerIdpHandler(name, handler)` (Android,
`Application.onCreate`) or `RNPingExternalIdpCommon.registerIdpHandler(_:handler:)`
(iOS, `didFinishLaunchingWithOptions`). The Journey authorize path resolves the
callback's provider through the registry first (exact match on the trimmed
lowercase name), then falls back to the untouched native built-ins, then the
existing unsupported-provider error. Names matching a built-in token are
rejected at registration; a non-empty configured `redirectUri` overrides the
redirect passed to custom handlers on both platforms.

The Android `com.pingidentity.sdks:external-idp` dependency moves from
`implementation` to `api` scope so `com.pingidentity.idp.*` types resolve from
app code without a separate dependency.

A new "Supporting additional social providers" section in the package README
documents the handler contract, registration, resolution order, reserved-name
guard, redirect override, nonce handling, cancellation convention, and
threading contract.

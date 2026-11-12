---
'@ping-identity/rn-oidc': patch
---

fix(rn-oidc): resolve iOS authorize cancellation as `cancel` and make `openId`-only configs work on both platforms (SDKS-5389)

A dismissed browser resolves with `{ type: 'cancel' }` on iOS instead of
rejecting. `openId`-only configs are accepted on iOS, and on Android the bridge
initializes `discoveryEndpoint` to blank so the native SDK 2.2.0 `clone()` does
not throw.

On iOS, the Journey and DaVinci error mappers now fold `OidcError.unknown`'s
cause error into the rejection message instead of emitting it as a
non-serializable `code`. rn-oidc's own mapper already behaved this way.

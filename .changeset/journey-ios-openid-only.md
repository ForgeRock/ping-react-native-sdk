---
'@ping-identity/rn-journey': patch
---

fix(rn-journey): make `openId`-only OIDC configs work on both platforms (SDKS-5389)

Accepted on iOS; on Android the bridge initializes `discoveryEndpoint` to blank
so the native SDK 2.2.0 `clone()` does not throw.

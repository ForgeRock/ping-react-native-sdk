---
'@ping-identity/rn-device-profile': minor
---

feat(rn-device-profile): include the readable device model name on iOS (SDKS-5389)

`platform.modelName` (for example `iPhone 14 Pro`), matching Android's readable
`model`. Omitted on the iOS Simulator and unrecognised hardware. See the README
for the Device Match impact.

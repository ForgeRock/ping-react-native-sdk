---
'@ping-identity/rn-device-profile': minor
---

feat(rn-device-profile): add the opt-in `includeModelName` option for iOS `platform.modelName` (SDKS-5389)

Pass `includeModelName: true` to `collectDeviceProfile` or
`collectDeviceProfileForJourney` to resolve the readable device name (for
example `iPhone 14 Pro`) into `platform.modelName`, matching Android's readable
`model`. Defaults to `false`, mirroring native 2.2.0's
`PlatformCollector(includeModelName:)` default, so profiles are unchanged unless
the app opts in. `modelName` is omitted on the iOS Simulator and unrecognised
hardware. See the README for the Device Match impact.

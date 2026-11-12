---
'@ping-identity/rn-davinci': patch
---

fix(rn-davinci): align QR and ErrorNode handling with native SDK 2.2.0 (SDKS-5389)

Android emits the native `key`, `raw`, and no longer special-cases QR_CODE in
`unsupportedFields`. Android emits `status` on ErrorNode payloads, matching iOS.
iOS returns the complete QR data URI in `content` as-is. On iOS,
`OidcError.unknown`'s cause error is now folded into the rejection message
instead of being emitted as a non-serializable `code`.

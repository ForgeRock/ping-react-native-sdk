---
'@ping-identity/rn-fido': minor
---

feat(rn-fido): rename `android.useFido2Client` to `android.useFido2ApiClient` and apply it to Journey and DaVinci authentication

Aligns with native Android SDK 2.2, where FIDO2 API selection is a per-call
authentication setting. The override now applies to `authenticate`,
`authenticateForJourney` and `authenticateForDaVinci`. Registration is unaffected.

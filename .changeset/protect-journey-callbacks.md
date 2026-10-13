---
'@ping-identity/rn-protect': minor
'@ping-identity/rn-journey': minor
---

feat(rn-protect): collectProtectForJourney, initializeProtectForJourney and startProtectForJourney for PingOne Protect Journey callbacks (SDKS-5391).

`startProtectForJourney` registers the Protect Journey callbacks without initializing Protect. Call it once at startup, before the first Journey `start()`.

`buildNextInput` in `@ping-identity/rn-journey` now skips PingOne Protect managed hidden-value fields (ids containing `pingone_risk_evaluation_signals` or `clientError`) so the native-written risk signal is not overwritten with stale defaults (SDKS-5391).

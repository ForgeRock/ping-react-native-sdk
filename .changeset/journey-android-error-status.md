---
'@ping-identity/rn-journey': patch
---

fix(rn-journey): emit the HTTP `status` on Android ErrorNode payloads (SDKS-5389)

Matches iOS; `JourneyNode` exposes `status?: number`.

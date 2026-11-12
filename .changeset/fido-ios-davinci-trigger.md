---
'@ping-identity/rn-fido': patch
---

fix(rn-fido): emit `trigger` on iOS DaVinci FIDO2 collector payloads (SDKS-5389)

Matches Android; `""` when the server omits it.

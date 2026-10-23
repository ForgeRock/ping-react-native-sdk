---
'@ping-identity/rn-oath': patch
---

fix(rn-oath): rework Android saveCredential to fetch-then-patch for native SDK 2.2 compatibility

Android native SDK 2.2 rejects `OathCredential` construction with a blank
secret, which made `saveCredential` fail on every call. The bridge now reads
only the credential `id` and the editable display fields from JS, fetches the
stored credential for every other field (including the secret), and saves the
patched result. iOS behaviour is unchanged and already used this pattern.

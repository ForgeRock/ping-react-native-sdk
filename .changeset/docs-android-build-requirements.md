---
'@ping-identity/rn-binding': patch
'@ping-identity/rn-browser': patch
'@ping-identity/rn-core': patch
'@ping-identity/rn-davinci': patch
'@ping-identity/rn-device-client': patch
'@ping-identity/rn-device-id': patch
'@ping-identity/rn-device-profile': patch
'@ping-identity/rn-external-idp': patch
'@ping-identity/rn-fido': patch
'@ping-identity/rn-journey': patch
'@ping-identity/rn-logger': patch
'@ping-identity/rn-oath': patch
'@ping-identity/rn-oidc': patch
'@ping-identity/rn-protect': patch
'@ping-identity/rn-push': patch
'@ping-identity/rn-recaptcha': patch
'@ping-identity/rn-storage': patch
'@ping-identity/rn-types': patch
---

docs: document Android JVM 21 and Kotlin 2.2 build requirements

Adds an "Android build requirements" section to the repository README and a
short note to each native package README covering JDK 21, Kotlin 2.2 or later,
the JVM 21 target, and the React Native Gradle plugin settings needed while it
aligns Android modules to JVM 17. The `rn-fido` README also notes that DaVinci
passkey registration on iOS is affected by an unreleased PingFido user ID fix.

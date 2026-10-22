---
'@ping-identity/rn-recaptcha': minor
'@ping-identity/rn-journey': minor
---

feat(rn-recaptcha): add `@ping-identity/rn-recaptcha` package with native reCAPTCHA Enterprise verification for Journey flows (SDKS-5390). `createRecaptchaClient().verifyForJourney(journey, options?)` completes the active `ReCaptchaEnterpriseCallback` using `com.pingidentity.sdks:recaptcha-enterprise` (Android) and `PingReCaptchaEnterprise` (iOS), reading the site key from the callback payload and resolving a `{ type: 'success' | 'failure' }` union. Also adds `JourneyReCaptchaEnterpriseField` to `@ping-identity/rn-journey` with an informational `siteKey` field

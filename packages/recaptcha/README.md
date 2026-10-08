[![Ping Identity](https://www.pingidentity.com/content/dam/picr/nav/Ping-Logo-2.svg)](https://github.com/ForgeRock/ping-react-native-sdk)

# Ping Identity React Native reCAPTCHA

This package provides a native-backed reCAPTCHA Enterprise bridge for React
Native, for Journey flows served by PingOne Advanced Identity Cloud (AIC) or
PingAM.

## Table of contents

- [Install](#install)
- [Prerequisites](#prerequisites)
- [Client usage](#client-usage)
- [Journey integration](#journey-integration)
- [`useJourneyForm` integration](#usejourneyform-integration)
- [API reference](#api-reference)
- [Errors](#errors)
- [Platform notes](#platform-notes)
- [License](#license)

## Install

> **Note:** This module requires that the `@ping-identity/rn-core` module is already set up and installed.

```bash
# Install & setup the core module
yarn add @ping-identity/rn-core
# Install the rn-recaptcha module
yarn add @ping-identity/rn-recaptcha
# If you are developing your app using iOS, run this command
cd ios && pod install
```

Optional integration packages:

```bash
yarn add @ping-identity/rn-logger
```

## Prerequisites

### Android

- Google Play Services must be available on the device (the Google reCAPTCHA
  Enterprise SDK requires it).
- The reCAPTCHA site key used by your journey tree must be bound to your
  Android package name in the Google Cloud console.
- Native dependency: `com.pingidentity.sdks:recaptcha-enterprise` (registered
  automatically via App Startup — no activation call is needed).

### iOS

- The `PingReCaptchaEnterprise` pod is installed transitively through this
  package's podspec and registers its callback with the Journey runtime as
  soon as it is linked — no activation call is needed.
- The reCAPTCHA site key used by your journey tree must be bound to your iOS
  bundle id in the Google Cloud console.

### Server

- The journey tree must contain an AM Captcha (Enterprise) node.
- **Enterprise only:** only `ReCaptchaEnterpriseCallback` is supported today.
  A server-issued `ReCaptchaCallback` (v2/v3) is not implemented in the
  upstream native SDKs and keeps hitting the integration-required path.

## Client usage

Use `createRecaptchaClient(config?)` and call operations on the returned
client.

```ts
import { createRecaptchaClient } from '@ping-identity/rn-recaptcha';
import { logger } from '@ping-identity/rn-logger';

const log = logger({ level: 'debug' });

const recaptcha = createRecaptchaClient({
  logger: log,
});

const result = await recaptcha.verifyForJourney(journey, {
  index: 0,
  action: 'login',
  timeoutMs: 15000,
});

if (result.type === 'success') {
  // result.token is credential-equivalent — never log it.
} else {
  // result.code and result.message describe the verification failure.
}
```

### Logging integration (optional)

If you install the logger package, pass a JS logger instance created via
`@ping-identity/rn-logger`. If the logger package is not installed or
configured, do not pass logger values in reCAPTCHA config. JavaScript-side
logs use this logger on both platforms; native logger forwarding applies to
verification calls.

```ts
import { createRecaptchaClient } from '@ping-identity/rn-recaptcha';
import { logger } from '@ping-identity/rn-logger';

const jsLogger = logger({ level: 'debug' });

const recaptcha = createRecaptchaClient({
  logger: jsLogger,
});
```

## Journey integration

Run the active `ReCaptchaEnterpriseCallback` explicitly before
`journey.next(...)`. The site key is never caller-supplied — the native
callback reads it from its own server payload and auto-submits the token (or
the client error) into the callback inputs that `next()` transmits.

```ts
import { createRecaptchaClient } from '@ping-identity/rn-recaptcha';

const recaptcha = createRecaptchaClient();

if (node.type === 'ContinueNode') {
  let typeIndex = 0;
  for (const callback of node.callbacks ?? []) {
    if (callback.type === 'ReCaptchaEnterpriseCallback') {
      await recaptcha.verifyForJourney(journey, { index: typeIndex++ });
    }
  }

  // Proceed in either outcome — on failure the client error is already
  // recorded in the callback inputs and the server decides what comes next.
  await journey.next({});
}
```

### Verification outcomes

`verifyForJourney` resolves a discriminated union instead of throwing for
verification failures:

- `{ type: 'success'; token: string }` — verification succeeded; the token was
  auto-submitted into the callback inputs.
- `{ type: 'failure'; code: string; message: string }` — verification failed;
  the client error was auto-submitted into the callback inputs. `code` carries
  the platform error taxonomy where available (for example `NETWORK_ERROR`,
  `INVALID_SITEKEY`, `INVALID_ACTION`, `INVALID_TIMEOUT`, `INTERNAL_ERROR`),
  falling back to `UNKNOWN_ERROR`.

Both variants mean the callback inputs were mutated natively, so the app may
proceed to `next()` in either case and let the server decide whether to
re-issue the Captcha node. Only bridge-level failures (no active callback,
invalid arguments, missing native module) reject with `RecaptchaError`.

## `useJourneyForm` integration

When using `useJourneyForm`, pass `handledCallbackTypes` so the
`ReCaptchaEnterpriseCallback` field is excluded from blocking submit issues.
Run verification, then submit when `form.canSubmit` is true. Do not pass a
value for the reCAPTCHA field — the token travels via the callback's own
inputs.

```ts
import {
  createJourneyClient,
  useJourney,
  useJourneyForm,
} from '@ping-identity/rn-journey';
import { callbackType } from '@ping-identity/rn-types';
import { createRecaptchaClient } from '@ping-identity/rn-recaptcha';

const journey = createJourneyClient({
  /* server config */
});

function LoginScreen() {
  const [node, actions] = useJourney(journey);
  const form = useJourneyForm(node, {
    handledCallbackTypes: new Set([
      // Only the Enterprise callback is natively supported today — see
      // "Platform notes" for ReCaptchaCallback (v2/v3).
      callbackType.ReCaptchaEnterpriseCallback,
    ]),
  });

  const completeRecaptcha = async () => {
    const recaptcha = createRecaptchaClient();
    for (const field of form.fields) {
      if (field.ref.type !== callbackType.ReCaptchaEnterpriseCallback) continue;
      const result = await recaptcha.verifyForJourney(journey, {
        index: field.ref.typeIndex,
        // site key is read natively from the callback payload — never passed here
      });
      if (result.type === 'failure') {
        // Callback inputs already carry the client error; the server decides
        // whether to re-issue the Captcha node. Surface result.message to the user.
      }
    }
    if (form.canSubmit) {
      await actions.next(form.input); // token travels via the callback's own inputs
    }
  };
  // ...
}
```

The normalized field exposes `siteKey` read from the raw callback payload.
It is informational only (for example, rendering a "protected by reCAPTCHA"
badge) and is never needed to execute verification.

## API reference

```ts
import { createRecaptchaClient } from '@ping-identity/rn-recaptcha';
import type {
  RecaptchaClient,
  RecaptchaConfig,
  RecaptchaVerifyOptions,
  RecaptchaVerifyResult,
  RecaptchaErrorCode,
  RecaptchaJsonValue,
  JourneyInstance,
  LoggerInstance,
} from '@ping-identity/rn-recaptcha';

function createRecaptchaClient(config?: RecaptchaConfig): RecaptchaClient;

interface RecaptchaClient {
  verifyForJourney(
    journey: JourneyInstance,
    options?: RecaptchaVerifyOptions,
  ): Promise<RecaptchaVerifyResult>;
}

type RecaptchaVerifyOptions = {
  /** Zero-based index among multiple ReCaptchaEnterpriseCallbacks. Defaults to 0. */
  index?: number;
  /** reCAPTCHA action name. Defaults to `'login'`. */
  action?: string;
  /** Verification timeout in milliseconds. Defaults to 15000. */
  timeoutMs?: number;
  /** Optional custom risk-assessment metadata submitted with the verification. */
  payload?: RecaptchaJsonValue;
};

type RecaptchaVerifyResult =
  | { type: 'success'; token: string }
  | { type: 'failure'; code: string; message: string };
```

## Errors

Rejected promises throw a `RecaptchaError` instance, which extends
`PingError extends Error`. Use `instanceof RecaptchaError` to narrow in catch
blocks.

Stable error codes:

- `RECAPTCHA_ERROR`
- `RECAPTCHA_VERIFY_ERROR`
- `RECAPTCHA_CALLBACK_NOT_FOUND`

Error semantics summary:

| Failure                                                | Behavior                                                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Verification failed (Google-side)                      | Resolves `{ type: 'failure', code, message }` — does **not** throw          |
| No active `ReCaptchaEnterpriseCallback` at `index`     | Throws `RecaptchaError` with `RECAPTCHA_CALLBACK_NOT_FOUND` (`state_error`) |
| Missing or invalid Journey instance / empty journey id | Throws `RecaptchaError` (`argument_error`) before any native call           |
| Native module missing                                  | Throws `Error` (not `RecaptchaError`) at `createRecaptchaClient()`          |

## Platform notes

- **Enterprise only.** `ReCaptchaCallback` (v2/v3) is not implemented in the
  upstream native SDKs on either platform; a server-issued v2/v3 callback
  keeps hitting the integration-required path. A standalone token API
  (`getToken(siteKey)`) is likewise unavailable — the native `verify()` is
  callback-bound and reads the site key from the callback payload.
- **Timeout normalization.** The native defaults differ (Android 10000ms,
  iOS 15000ms). The bridge always forwards an explicit `timeoutMs`
  (default 15000) to both platforms so behavior is identical; native defaults
  are never relied upon. A negative `timeoutMs` passes through so the Google
  SDK surfaces its own `INVALID_TIMEOUT` error rather than the bridge
  silently substituting the default.
- **Action mapping.** `action` is a single string (default `'login'`).
  Android maps `'login'` to `RecaptchaAction.LOGIN`, `'signup'` to
  `RecaptchaAction.SIGNUP`, and any other value to `RecaptchaAction.custom(value)`;
  iOS passes the string to `RecaptchaAction(customAction:)` directly.
- **Failure-path submission asymmetry (upstream).** On verification failure,
  Android submits an empty token, the action, the client error, and an empty
  payload into the callback inputs; iOS submits only the client error. The
  server therefore receives a slightly different partial-input set per
  platform on client failure. Flagged upstream — see the `TODO-PARITY` note
  in `packages/recaptcha/ios/RNPingRecaptchaCommon.swift`.
- **Android** requires Google Play Services on the device/emulator.
- **iOS** verification is headless — no window anchor or UI anchor is
  required.
- reCAPTCHA Enterprise mobile verification is non-interactive; there is no
  user-cancel primitive. Cancellation of the underlying operation propagates
  as a rejection with `RECAPTCHA_VERIFY_ERROR`.

## E2E testing note

Real Google verification requires an environment with a configured site key
bound to the test app and a reCAPTCHA Enterprise-enabled journey tree. The
PingTestRunner scenario (`PING_TEST_SCENARIO=recaptcha`) degrades
deterministically without one: the verify attempt surfaces the failure or
error payload, so E2E asserts bridge wiring rather than Google's service.
True Google-service behavior is a manual / BrowserStack-config concern.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details

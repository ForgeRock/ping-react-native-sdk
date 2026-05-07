<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

# Open TODOs

## Concurrency (SDKS-concurrency)

Apply the static-methods + actor pattern used in the `binding` package to the remaining packages.

**Packages with mutable state — requires actor extraction:**

| Package         | Mutable state                                                 |
| --------------- | ------------------------------------------------------------- |
| `logger`        | `DynamicLogger.level`, `JsLoggerIdStore.map` (NSLock-guarded) |
| `device-client` | `registry: [String: DeviceClient]` (NSLock-guarded)           |
| `journey`       | `JourneyStateStore.nodeMap/continueNodeMap`, `Ref<T>.value`   |

**Packages with no mutable state — static methods + `.mm` update only:**

`storage`, `oidc`, `device-profile`, `fido`, `browser`, `device-id`

---

## Semver safety (SDKS-semver)

Before 1.0, all exported string union types that consumers branch on must be widened so
that adding a new member is a non-breaking minor release rather than a major.

**Fix for plain string unions** — append `| (string & {})`:

```ts
export type FooErrorCode = 'FOO_KNOWN_CODE' | (string & {}); // allows unknown future codes, preserves autocomplete
```

**Fix for discriminated object unions** — widen the `type` discriminant field:

```ts
export type FooResult =
  | { type: 'success'; value: string }
  | { type: 'cancel' }
  | { type: string & {}; [key: string]: unknown }; // absorbs future variants
```

Consumers must always have a `default` branch in any switch over these types.

### Affected types

| Type                     | Package          | File                               |
| ------------------------ | ---------------- | ---------------------------------- |
| `BindingErrorCode`       | `binding`        | `src/types/binding.types.ts`       |
| `JourneyErrorCode`       | `journey`        | `src/types/error.types.ts`         |
| `JourneyExecutionMode`   | `journey`        | `src/types/form.types.ts`          |
| `JourneySubmitIssueCode` | `journey`        | `src/types/form.types.ts`          |
| `FidoErrorCode`          | `fido`           | `src/types/fido.types.ts`          |
| `OidcErrorCode`          | `oidc`           | `src/types/oidc.types.ts`          |
| `OidcAuthorizeResult`    | `oidc`           | `src/types/oidc.types.ts`          |
| `DeviceClientErrorCode`  | `device-client`  | `src/types/error.types.ts`         |
| `DeviceKind`             | `device-client`  | `src/types/device.types.ts`        |
| `DeviceProfileErrorCode` | `device-profile` | `src/types/deviceProfile.types.ts` |
| `BrowserResult`          | `browser`        | `src/types/browser.types.ts`       |

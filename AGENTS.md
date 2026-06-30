<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, GitHub Copilot, Gemini, etc.) when working with code in this repository. It follows the open AGENTS.md convention.

> **Note:** CLAUDE.md in this repository is a one-line redirect to AGENTS.md. Edit AGENTS.md only.

## Project Context

**Ping Identity React Native SDK** — a Yarn monorepo of independent native SDK wrappers (Storage, OIDC, Browser, Journey, FIDO, etc.) exposed as TurboModules.

- Packages live under `packages/*`; native code under `packages/*/android` and `packages/*/ios`
- Node `>=20`, Yarn 4 required
- `PingSampleApp/` — reference app demonstrating SDK features (Journey, OIDC, FIDO, device binding, etc.); used for manual testing and development. Open `PingSampleApp/android` in Android Studio or `PingSampleApp/ios/PingSampleApp.xcworkspace` in Xcode for native IDE work.
- `PingTestRunner` — E2E test harness; hosts Detox scenarios and integration tests
- Follow existing package patterns before introducing new structures or abstractions

## Native SDK References

When planning or implementing native bridge changes, refer to the upstream SDK source:

- **Android SDK**: https://github.com/ForgeRock/ping-android-sdk
- **iOS SDK**: https://github.com/ForgeRock/ping-ios-sdk

## Package Structure

| Package                            | Native bridge   | Description                                                                                                 |
| ---------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| `@ping-identity/rn-types`          | None (TS only)  | Shared TypeScript contracts used across all SDK packages                                                    |
| `@ping-identity/rn-core`           | Foundation only | Shared native utilities (Registry, error mappers, bridge helpers) — not consumed directly by apps           |
| `@ping-identity/rn-logger`         | Yes             | Configures and syncs native log level on iOS/Android                                                        |
| `@ping-identity/rn-storage`        | Yes             | Secure persistent data storage                                                                              |
| `@ping-identity/rn-device-id`      | Yes             | Generates and retrieves unique device identifiers                                                           |
| `@ping-identity/rn-device-profile` | Yes             | Collects structured device information                                                                      |
| `@ping-identity/rn-device-client`  | Yes             | Device management bridge — OATH, Push, Bound Device, WebAuthn, and Device Profile                           |
| `@ping-identity/rn-browser`        | Yes             | Launches in-app browser sessions                                                                            |
| `@ping-identity/rn-journey`        | Yes             | Ping Identity Journey orchestration and callback handling                                                   |
| `@ping-identity/rn-oidc`           | Yes             | OIDC authentication flows                                                                                   |
| `@ping-identity/rn-fido`           | Yes             | Native-backed FIDO/passkey capabilities                                                                     |
| `@ping-identity/rn-external-idp`   | Yes             | Authentication with external identity providers                                                             |
| `@ping-identity/rn-binding`        | Yes             | Native MFA device binding bridge                                                                            |
| `@ping-identity/rn-oath`           | Yes             | OATH TOTP/HOTP token management                                                                             |
| `@ping-identity/rn-push`           | Yes             | Push MFA — enrollment, credential management, notification processing, and approve/deny/challenge responses |

Turbo orchestrates builds and tests across workspaces.

## Design & Quality

- Prefer consistency with existing packages over new abstractions
- Follow SOLID principles (small focused units, low coupling)
- Keep changes DRY: reuse existing utilities; avoid copy/paste duplicate code
- Prefer composition over inheritance
- Use clear, intention-revealing names; avoid abbreviations unless domain-standard
- Before adding native bridge/parsing helpers, check `packages/core/android/src/main/` (Kotlin) and `packages/core/ios/` (Swift) for available utilities.
- Follow security best practices (OWASP); do not introduce insecure shortcuts (disabled TLS checks, hard-coded secrets, plaintext storage)
- Call out potential security risks explicitly if present

### Pre-submission checklist

- Verify pattern consistency with existing packages
- Verify license headers are present on all new source files
- Verify comments follow the file's existing style
- Call out any security or design concerns explicitly

## Build & Test Commands

**Root-level (runs across all packages via Turbo):**

```bash
yarn packages:build               # Build all packages
yarn lint                          # ESLint
yarn typecheck                    # TypeScript type checking (requires prior build)
yarn prettier                     # Prettier formatting check
yarn test                         # Jest tests in ./packages/*
yarn test:affected:coverage       # CI: tests with coverage on files changed since TURBO_SCM_BASE
```

**Per-package:**

```bash
yarn workspace @ping-identity/rn-<package> test    # e.g. rn-logger, rn-storage
yarn workspace @ping-identity/rn-<package> build
yarn exec prettier --write "packages/<pkg>/src/**/*.{js,jsx,ts,tsx}"  # Fix formatting (run this first)
yarn prettier --filter=@ping-identity/rn-<package> # Check formatting (confirm after fix)
```

**Sample app:**

```bash
yarn sample:clean-install    # Clear build/cache, reinstall, pod install
yarn sample:run:ios
yarn sample:run:android
```

For TypeScript changes, run in this sequence: `prettier` → `lint` → `typecheck` → relevant `test`.

**Config files:** ESLint: `eslint.config.mjs` · Prettier: `.prettierrc.js` · Turbo: `turbo.json` · Jest: per-package

**Git hooks (Lefthook):** pre-commit runs Prettier check, ESLint, and copyright header check on staged files. pre-push runs `prettier`, `lint`, and `typecheck` on affected packages. Hooks are enforced automatically — fix failures before committing.

## Releases

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning. All packages are versioned in lockstep (`fixed: ["@ping-identity/*"]`).

When making a user-visible change to a public package API:

- Run `yarn changeset` and follow the prompts to describe the change
- Commit the generated `.changeset/*.md` file alongside your code change
- Do NOT manually edit `package.json` versions

Release scripts: `yarn release:status` · `yarn release:version` · `yarn release:publish`

## Dual-Architecture Bridge Pattern

Every native package supports **both** React Native New Architecture (TurboModules) and the **classic bridge**. Shared business logic lives in `*Common` files consumed by both entry points.

### Android layout (`packages/<pkg>/android/src/`)

```text
main/       ← *Common.kt — shared implementation
newarch/    ← *Module.kt (extends NativeXxxSpec) + *Package.kt
oldarch/    ← *ClassicModule.kt (extends ReactContextBaseJavaModule) + *Package.kt
```

- New arch module name: `"<ModuleName>"` (matches `TurboModuleRegistry` key)
- Classic module name: `"RNPing<ModuleName>Classic"` (consumed via `NativeModules`)
- See `packages/logger` for a concrete example.

**Exception:** `rn-core` only has `/main` (no `newarch/` or `oldarch/`) — it is a foundation-only package with no TurboModule entry point of its own.

### iOS layout (`packages/<pkg>/ios/`)

```text
*Common.swift / *Impl.swift    ← shared Swift implementation
RNPing*.mm                     ← TurboModule (ObjC++): implements getTurboModule:
RNPing*Classic.mm              ← Classic bridge (ObjC): RCT_EXPORT_MODULE + RCT_EXPORT_METHOD
RNPing*.h                      ← Header for classic bridge linking
```

### TypeScript bridge (`src/NativeRNPing*.ts`)

```ts
export function getNativeModule(): Spec {
  const turbo = TurboModuleRegistry.get<Spec>('ModuleName');
  if (turbo) return turbo;
  const classic = NativeModules.RNPingModuleClassic as Spec | undefined;
  if (classic) return classic;
  throw new Error('Native module not found…');
}
```

The wrapper object calls `getNativeModule()` lazily at invocation time, not at import time. Packages that call `getNativeModule()` on every invocation should cache the result in a module-level `_nativeModule` variable to avoid re-probing the registry on each call. Packages that eagerly export the module at load time do not need a cache.

When adding new methods or packages: implement in `*Common`, then expose via both `newarch` and `oldarch`.

## Code Standards

### Swift 6 conventions

Pods declare `swift_version = ['5.0', '5.1', '6.0']` — all Swift must compile under Swift 6 strict concurrency.

- Prefer `actor` over classes with manual locking for shared mutable state
- Use `@MainActor` explicitly on UI-bound types; do not rely on implicit assumptions
- All types crossing actor/task boundaries must be `Sendable`; `@unchecked Sendable` only for immutable wrappers around non-`Sendable` upstream types or classes with all mutable access guarded by `NSLock`
- Prefer `async/await` and structured concurrency over `DispatchQueue` or completion handlers
- Avoid `Task.detached` unless an explicit executor is required and justified
- Mark `nonisolated` only on methods that genuinely do not access actor-isolated state

### Kotlin 2.x conventions

All packages target Kotlin 2.2.10.

- Prefer `suspend` functions and coroutines over callbacks
- Never use `GlobalScope` — always tie coroutine lifetime to a `CoroutineScope` with proper lifecycle cleanup
- Pick the dispatcher that matches what the native SDK uses internally — check the source first (grep for `withContext`/`Dispatchers`). Use `Dispatchers.Main` only when an Activity context is required; document the reason.
- Prefer `StateFlow`/`SharedFlow` over mutable callbacks
- Use `sealed class`/`sealed interface` for exhaustive error/state modelling
- Avoid `!!` — use `requireNotNull`, `checkNotNull`, or safe calls with fallback
- Never use `if (x != null) ... else ...` — use `x?.let { } ?: ` instead
- Prefer `Result<T>` for error propagation in `suspend` functions at module boundaries
- Use `buildList`, `buildMap` instead of mutating a list then returning it

### TypeScript API conventions

**Public API shape:**

- Stateful features: factory function (`createXxxClient(config, options?)`) returning a plain object literal — not a class
- Stateless operations (device ID, device profile, browser): standalone async functions
- React integrations: Context + hook pair (`useXxx`) on top of the client

**File structure per package `src/`:**

- `index.tsx` — public API re-exports only, no implementation logic
- `NativeRNPing*.ts` — `Spec` interface, `getNativeModule()`, lazy wrapper
- `types/` — all exported TypeScript types
- Implementation files — business logic, separated from the barrel

**Exception:** `rn-core` has an intentionally empty `index.js` (native-only foundation, not consumed directly by apps).

**Native spec types:**

- `export interface Spec extends TurboModule { ... }`
- Methods accepting config objects use `Object` in `Spec` (codegen constraint); strict types applied in the JS facade

**Result types:**

- Discriminated union for multi-outcome operations: `{ type: 'success'; ... } | { type: 'cancel' }` — never optional fields on a single shape
- Return types of all exported functions must be exported from the same `index.tsx`

**Exports:**

- `export type * from './types'` for type-only re-exports; named `export { ... }` for values
- Never export internal helpers, native wrappers, or `noopLogger` from the package index

### Error handling

- Use `GenericError` from `@ping-identity/rn-types` with `type`, `error`, and `message` fields
- Validate inputs before calling native; throw `{ type: 'argument_error', ... }` for caller mistakes
- All catch blocks must log or re-throw — no silent failures

### Logging

- Accept optional `logger?: LoggerOptions`; provide a module-level `noopLogger` as default
- Log method entry at `debug`, outcomes at `info`, failures at `error`

### Shared core utilities

- Prefer utilities from `@ping-identity/rn-core` over reimplementing them — check `packages/core/android/src/main/` (Kotlin) and `packages/core/ios/` (Swift) for available helpers before writing new bridge/parsing code
- If a utility is used by more than one package, it belongs in `rn-core` — move it before merging

### Native SDK verification

Before making any claim about what a native SDK method throws, returns, or does — read the actual implementation body. Doc comments and method signatures are not authoritative.

Lookup order:

1. **iOS** — `PingSampleApp/ios/Pods/<SDK>/` or `PingTestRunner/ios/Pods/<SDK>/`
2. **Android** — Gradle cache under `~/.gradle/caches/` (search by package name)
3. **Fallback** — fetch from the public repos listed above

Never infer behavior from a signature alone — always verify the body. This includes verifying encode/decode symmetry by reading both sides of the native model.

This check is **required** whenever:

- Addressing a PR review comment about native bridge behavior (throws, returns, error types, side effects)
- Adding or modifying error handling that wraps a native SDK call
- Making a claim in code or comments about what a native method does

### Cross-platform parity

- When implementing a bridge method that exists on both platforms, read both implementations before writing
- If one platform fetches a stored record before mutating it (to preserve server/native-managed fields), the other must do the same
- When a bridge implementation must work around a missing SDK primitive, add a `TODO-PARITY` referencing a native defect ticket at time of writing
- When creating new packages always check for any parity issues in both platforms and flag them beforehand

### Native bridge consistency

- Changes to `*Common.kt`/`*Common.swift` must be mirrored in both `newarch/` and `oldarch/`
- New methods must be exposed via both TurboModule and classic module
- Do NOT modify `build.gradle` versions without approval
- Avoid introducing new dependencies unless explicitly requested

### Kotlin file naming

- Every top-level public class must live in its own file named after it — never declare a top-level class inside another class's file

## Documentation Conventions

### TypeScript / JavaScript (TSDoc)

Use TSDoc `/** */` on all exported functions, types, and interfaces. Required tags:

- `@param <name>` — describe each parameter
- `@returns` — describe the return value (omit for `void`)
- `@throws` — describe every error condition
- `@example` — at least one runnable usage snippet for public API entry points
- `@remarks` — required when behaviour differs between iOS and Android, or between old-arch and new-arch
- `@public` / `@internal` — mark visibility explicitly on anything that might be ambiguous

### Kotlin (KDoc)

Use KDoc `/** */` on all public and internal declarations. Required tags: `@param`, `@return`, `@throws`. Use a plain `// NOTE:` comment for platform nuances or lifecycle notes that would otherwise go in `@remarks`.

### Swift

Use triple-slash `///` on all public and internal declarations. Required tags: `- Parameters:`, `- Returns:`, `- Throws:`, `- Note:`.

No branding, marketing language, emojis, signatures, or decorative content in any source file or documentation.

## Testing

- Tests in `__tests__/` with `.test.ts` or `.spec.ts` naming
- Mock `react-native` properly (Platform, TurboModuleRegistry, NativeModules)
- Make sure unit tests and integration tests are written
- Robolectric tests must always use `@Config(sdk = [29])`

### PingTestRunner integration

New user-facing flows require all three of:

1. **Scenario screen** — `PingTestRunner/scenarios/` with deterministic `testID` props
2. **App.tsx switch** — register the scenario name in the `PING_TEST_SCENARIO` switch
3. **E2E test** — `PingTestRunner/e2e/<feature>.test.ts` driven by Detox

Run E2E tests from `PingTestRunner/`:

```bash
yarn build:e2e:ios && yarn test:e2e:ios
yarn build:e2e:android && yarn test:e2e:android
```

For new packages, also add the native Android Gradle module to `test:native:android` in `PingTestRunner/package.json`.

Integration-only changes (no new UI scenario) still require a test in `PingTestRunner/__tests__/integration/` and a `moduleNameMapper` entry in its `jest.config.js`.

## Licensing (Mandatory)

- Every new source file must include the project's license header at the top of the file
- Use the same license text and formatting as existing files in the repository
- Do not invent or modify license headers
- If the correct license header is unclear, stop and ask before proceeding

## Contributing / Branch Strategy

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full development workflow. Key rules for agents:

- Branch from `main`; keep PRs focused on one logical change
- Every PR needs a changeset file — run `yarn changeset` for user-visible changes, or `yarn changeset --empty` for docs/CI-only changes that don't affect published packages
- PR title format: `<type>(<scope>): <description> (TICKET-ID)` — e.g. `fix(rn-oidc): handle null token (SDKS-1234)`
  - Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`
  - Scope: the affected package short name (e.g. `rn-oidc`, `rn-fido`) or `sample-app`, `e2e`, `docs`
- CI will fail if no changeset is present — this is enforced by the `ci.yml` workflow

## Git Safety

Agents must not run any Git command that modifies repository state or remote refs.

**Forbidden — local state mutation:**
`git add`, `git commit`, `git stash`, `git stash pop`, `git reset`, `git restore`, `git checkout --`, `git clean`

**Forbidden — history rewriting:**
`git rebase`, `git cherry-pick`, `git merge`, `git amend`

**Forbidden — remote operations:**
`git push`, `git fetch --prune`, `git remote`

**Forbidden — ref deletion:**
`git branch -D`, `git tag -d`

**Allowed (read-only):**
`git status`, `git diff`, `git log`, `git show`, `git branch` (list only), `git stash list` (list only)

If any of the above operations are needed, stop and ask the user to run the command manually.

## CI/CD

All CI workflows live under `.github/workflows/`. `ci.yml` is the top-level PR check — it orchestrates the sub-workflows below via `workflow_call`. When a CI check fails, find the failing job name in the GitHub Actions log and look up the corresponding sub-workflow file.

| Workflow                                  | Trigger                      | Purpose                                                                 |
| ----------------------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| `ci.yml`                                  | PR opened / updated          | Orchestrates all PR checks — delegates to the sub-workflows below       |
| `lint-and-typecheck.yml`                  | `workflow_call`              | ESLint + TypeScript type checking                                       |
| `build-packages.yml`                      | `workflow_call`              | Builds all packages via Turbo; checks for changeset file                |
| `js-unit-tests.yml`                       | `workflow_call`              | Jest unit tests with affected-file detection (`TURBO_SCM_BASE`)         |
| `build-and-test-android.yml`              | `workflow_call`              | Android build + Robolectric unit tests                                  |
| `build-and-test-ios.yml`                  | `workflow_call`              | iOS build + XCTest unit tests                                           |
| `browserstack-prep-android-artifacts.yml` | `workflow_call`              | Assembles Android APKs for BrowserStack upload                          |
| `browserstack-prep-ios-artifacts.yml`     | `workflow_call`              | Builds iOS `.ipa` for BrowserStack upload                               |
| `browserstack-e2e-android-journey.yml`    | `workflow_call`              | BrowserStack E2E — Android Journey flows                                |
| `browserstack-e2e-android-core.yml`       | `workflow_call`              | BrowserStack E2E — Android core SDK flows                               |
| `browserstack-e2e-ios.yml`                | `workflow_call`              | BrowserStack E2E — iOS flows                                            |
| `browserstack-parse-results-ios.yml`      | `workflow_call`              | Parses and reports BrowserStack iOS results                             |
| `e2e-tests.yml`                           | Manual (commented out in CI) | Local Detox E2E — not run automatically; triggered manually when needed |
| `release.yml`                             | `workflow_dispatch`          | Changeset version bump + npm publish to all `@ping-identity/*` packages |
| `build-docs.yml`                          | `workflow_call`              | Generates TypeDoc API docs                                              |
| `preview-docs.yml`                        | PR opened / updated          | Publishes docs preview to GitHub Pages for the PR                       |
| `publish-docs.yml`                        | Push to `main`               | Publishes final docs to GitHub Pages                                    |
| `cleanup-docs-preview.yml`                | PR closed                    | Removes the PR docs preview from GitHub Pages                           |
| `mend-cli-scan.yml`                       | Scheduled                    | Mend (WhiteSource) security and dependency vulnerability scan           |

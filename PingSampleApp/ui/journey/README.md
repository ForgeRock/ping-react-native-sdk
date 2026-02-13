<!--
Copyright (c) 2026 Ping Identity Corporation. All rights reserved.

This software may be modified and distributed under the terms
of the MIT license. See the LICENSE file for details.
-->

# Journey Sample UI Documentation

This folder contains the React Native sample implementation for rendering and driving Journey callbacks in the sample app.

The sample is intentionally UI-owned:
- SDK (`@ping-identity/rn-journey`) provides Journey state/actions.
- Sample app decides how callbacks are rendered and submitted.
- Native SDK remains authoritative for callback validation and flow progression.

## Scope

- Demonstrate real Journey callback handling patterns.
- Provide debugging visibility for callback payloads and submissions.
- Keep extension points explicit for integration-required callbacks.
- Show a maintainable structure that can scale across callback types.

## Folder Structure

- `components/`: screen-facing Journey UI composition.
- `hooks/`: stateful orchestration logic for form state, auto progression, and submissions.
- `utils/`: callback type/value helpers and debug payload sanitation.
- `renderers/`: callback-type-specific render functions and shared renderer primitives.

## Runtime Data Flow

1. `JourneyScreen` renders `JourneyClientPanel`.
2. `JourneyClientPanel` reads Journey state/actions from `useJourney()`.
3. Current `ContinueNode` callbacks are normalized into deterministic `CallbackEntry` items (`type + typeIndex + absoluteIndex`).
4. `useJourneyScreenState` initializes/maintains draft input values per callback.
5. `JourneyCallbackForm` delegates each callback entry to `renderers/registry.ts`.
6. Renderer functions bind UI controls to the form draft state.
7. `useJourneySubmission` builds typed `next({ callbacks: [...] })` payloads.
8. `useJourneyAutoProgress` handles non-manual callbacks (device profile, polling).
9. `JourneyDebugPanel` shows sanitized inbound/outbound callback payload traces.

## Components Reference

### `components/JourneyClientPanel.tsx`

Top-level Journey UI orchestrator for one client instance.

Responsibilities:
- Consumes `useJourney()` tuple (`node`, `start`, `next`, `resume`, `user`, `logoutUser`, `loading`, `error`).
- Computes callback entry metadata for deterministic rendering/submission.
- Composes state hooks:
  - `useJourneyScreenState`
  - `useJourneyAutoProgress`
  - `useJourneySubmission`
- Emits debug timeline events for:
  - `start()`, `resume()`, `logoutUser()`
  - received nodes
  - submitted `next()` payloads
- Renders composed UI panels:
  - `JourneyStartPanel`
  - `JourneyCallbackForm`
  - `JourneyStatusPanel`
  - `JourneySessionCard`
  - `JourneyDebugPanel`

### `components/JourneyCallbackForm.tsx`

Callback form container.

Responsibilities:
- Maps `CallbackEntry[]` to renderer invocations.
- Applies field updates using stable `callbackKey(type, typeIndex)` keys.
- Memoizes each callback row (`JourneyCallbackEntryItem`) to reduce unnecessary re-renders.
- Passes `CallbackRenderContext` to callback renderers.

### `components/JourneyStartPanel.tsx`

Journey bootstrap panel.

Responsibilities:
- Journey name input.
- Suggested journey chips.
- Start button and loading indicator.

### `components/JourneyStatusPanel.tsx`

Terminal-node panel.

Responsibilities:
- Success view (`SuccessNode`) with refresh/logout actions.
- Error messaging for:
  - `ErrorNode` (server-side validation type failures)
  - `FailureNode` (unexpected runtime failures)
  - hook-level `error`.

### `components/JourneySessionCard.tsx`

Displays serialized session payload when available.

### `components/JourneyDebugPanel.tsx`

Visual debug timeline for callback testing.

Responsibilities:
- Renders timestamped debug entries.
- Shows sanitized payload snapshots.
- Allows clearing the timeline.

## Hooks Reference

### `hooks/useJourneyScreenState.ts`

Screen-level state model.

Responsibilities:
- Maintains form draft values (`inputValues`) by callback key.
- Hydrates default values from callback payloads on node changes.
- Retrieves and stores:
  - `journeyId`
  - journey suggestions (AsyncStorage)
  - resume URL draft
  - session and `given_name`
- Exposes UI transition helpers:
  - `markJourneyStarted`
  - `markJourneyLoggedOut`
  - `refreshSession`

### `hooks/useJourneySubmission.ts`

Manual submit path.

Responsibilities:
- Builds callback mutation payloads by callback type.
- Skips auto/system callbacks from manual payload.
- Enforces required agreement constraints before submit:
  - `TermsAndConditionsCallback`
  - required `ConsentMappingCallback`
- Exposes:
  - `onSubmit`
  - `onConfirmationSelect`
  - `hasManualSubmit`
  - `hasBlockingIntegration`
  - `hasUnacceptedRequiredAgreements`

### `hooks/useJourneyAutoProgress.ts`

Automatic progression path.

Responsibilities:
- Detects `DeviceProfileCallback` and submits device profile collection flow.
- Detects `PollingWaitCallback` and triggers delayed `next({})`.
- Uses node signatures to dedupe re-processing per callback mode.
- Resets auto-progress state on terminal nodes.

## Utils Reference

### `utils/callbacks.ts`

Callback classification and value conversion utilities.

Responsibilities:
- Defines sample callback shape (`JourneyCallbackLike`) and form state types.
- Defines callback category sets:
  - integration-required
  - output-only
  - manual-input
- Provides read/normalize helpers:
  - `readString`
  - `readNumber`
  - `readBoolean`
  - `readStringArray`
- Provides stable key helpers:
  - `callbackKey`
  - `nodeKey`
- KBA helpers:
  - `buildKbaDraft`
  - `parseKbaDraft`

### `utils/debug.ts`

Safe debug logging helpers.

Responsibilities:
- Creates debug entries with timestamp and ID.
- Sanitizes nested payloads by redacting sensitive keys.
- Formats payloads for readable in-app rendering.

## Renderer System Reference

### `renderers/registry.ts`

Renderer dispatch entry point.

Responsibilities:
- Resolves callback type to renderer function.
- Routes integration-required callbacks to `integrationRequiredRenderer`.
- Falls back to `defaultInputRenderer` for unknown-but-input-style callbacks.

### `renderers/types.ts`

Shared renderer contracts:
- `CallbackFormContext`
- `CallbackRenderContext`
- `CallbackRenderer`

### `renderers/styles.ts`

Renderer-scoped shared style tokens.

### `renderers/textFieldRendererBase.tsx`

Base implementation for text-like inputs.

Used by:
- `nameRenderer`
- `passwordRenderer`
- `textInputRenderer`
- `stringAttributeInputRenderer`
- `numberAttributeInputRenderer`
- `validatedCreateUsernameRenderer`
- `validatedCreatePasswordRenderer`

### `renderers/toggleRendererBase.tsx`

Base implementation for boolean/toggle inputs.

Used by:
- `booleanAttributeInputRenderer`
- `consentMappingRenderer`
- `termsAndConditionsRenderer`

### Callback-specific renderers

- `booleanAttributeInputRenderer.tsx`: `BooleanAttributeInputCallback`.
- `choiceRenderer.tsx`: `ChoiceCallback`.
- `confirmationRenderer.tsx`: `ConfirmationCallback` action buttons.
- `consentMappingRenderer.tsx`: `ConsentMappingCallback` toggle + metadata.
- `defaultInputRenderer.tsx`: unknown callback fallback text/number input.
- `deviceProfileRenderer.tsx`: display card for `DeviceProfileCallback`.
- `hiddenValueRenderer.tsx`: hidden callback visibility/debug card.
- `integrationRequiredRenderer.tsx`: unsupported-in-sample integration warning UI.
- `kbaCreateRenderer.tsx`: question/answer editor for `KbaCreateCallback`.
- `metadataRenderer.tsx`: metadata callback payload viewer.
- `nameRenderer.tsx`: `NameCallback`.
- `numberAttributeInputRenderer.tsx`: `NumberAttributeInputCallback`.
- `passwordRenderer.tsx`: `PasswordCallback`.
- `pollingWaitRenderer.tsx`: `PollingWaitCallback` wait-state card.
- `stringAttributeInputRenderer.tsx`: `StringAttributeInputCallback`.
- `suspendedTextOutputRenderer.tsx`: `SuspendedTextOutputCallback` info + resume controls.
- `termsAndConditionsRenderer.tsx`: `TermsAndConditionsCallback` required acceptance UI.
- `textInputRenderer.tsx`: `TextInputCallback`.
- `textOutputRenderer.tsx`: `TextOutputCallback`.
- `validatedCreatePasswordRenderer.tsx`: `ValidatedCreatePasswordCallback`.
- `validatedCreateUsernameRenderer.tsx`: `ValidatedCreateUsernameCallback`.

## Extension Guide

To add a new callback renderer:

1. Add callback type classification in `utils/callbacks.ts` as needed.
2. Create renderer in `renderers/`.
3. Register it in `renderers/registry.ts`.
4. Ensure submit behavior is mapped in `hooks/useJourneySubmission.ts` when manual input is required.
5. Add debug visibility expectations in `components/JourneyClientPanel.tsx` if needed.

## Debug and Security Notes

- Debug payloads are sanitized using `utils/debug.ts`.
- Sensitive keys (`password`, `token`, `secret`, etc.) are redacted recursively before rendering.
- This sample is intended for validation/testing visibility; avoid production logging of raw callback payloads.


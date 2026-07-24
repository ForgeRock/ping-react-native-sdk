/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type {
  DaVinciBuildNextInputResult,
  DaVinciCollector,
  DaVinciCollectorInput,
  DaVinciExecutionMode,
  DaVinciFieldKind,
  DaVinciFormMeta,
  DaVinciFormValue,
  DaVinciFormValues,
  DaVinciNextInput,
  DaVinciNode,
  DaVinciNormalizedCollector,
  DaVinciSubmitIssue,
} from './types';

const manualCollectorTypes = new Set<string>([
  'TEXT',
  'PASSWORD',
  'PASSWORD_VERIFY',
  'SINGLE_SELECT',
  'DROPDOWN',
  'RADIO',
  'MULTI_SELECT',
  'COMBOBOX',
  'CHECKBOX',
  'PHONE_NUMBER',
  'DEVICE_REGISTRATION',
  'DEVICE_AUTHENTICATION',
]);

const outputOnlyCollectorTypes = new Set<string>(['LABEL']);

const immediateCollectorTypes = new Set<string>([
  'SUBMIT_BUTTON',
  'ACTION',
  'FLOW_BUTTON',
  'FLOW_LINK',
]);

/**
 * `FlowCollector` type strings — the subset of `immediateCollectorTypes` that
 * advances the flow via its own key rather than submitting the whole form.
 *
 * @remarks
 * Used by `useDaVinciForm` to detect when `setValue`/`setValueByType` targets
 * a `FlowCollector` so it can auto-submit via `next()` instead of only
 * updating form state. Excludes `SUBMIT_BUTTON`, which submits the full form
 * payload rather than a single bypassing key.
 *
 * @internal
 */
export const flowCollectorTypes = new Set<string>([
  'ACTION',
  'FLOW_BUTTON',
  'FLOW_LINK',
]);

/**
 * Collector type strings handled entirely by an external integration package
 * (e.g. `rn-external-idp`, `rn-fido`, `rn-device-client` / Protect).
 *
 * @remarks
 * Each integration ticket registers its own type strings here when the matching
 * native collector is added:
 * - IdP collector → `'SOCIAL_LOGIN_BUTTON'` (SDKS-5128)
 * - FIDO collectors → `'FIDO_REGISTRATION'` / `'FIDO_AUTHENTICATION'`
 * - Protect collector → `'PROTECT'`
 *
 * @public
 */
export const integrationRequiredCollectorTypes = new Set<
  DaVinciCollector['type']
>(['SOCIAL_LOGIN_BUTTON']);

const textFieldKindTypes = new Set<string>(['TEXT', 'HIDDEN']);
const passwordFieldKindTypes = new Set<string>(['PASSWORD', 'PASSWORD_VERIFY']);
const singleSelectFieldKindTypes = new Set<string>([
  'SINGLE_SELECT',
  'DROPDOWN',
  'RADIO',
]);
const multiSelectFieldKindTypes = new Set<string>([
  'MULTI_SELECT',
  'COMBOBOX',
  'CHECKBOX',
]);
const phoneFieldKindTypes = new Set<string>(['PHONE_NUMBER']);
const deviceFieldKindTypes = new Set<string>([
  'DEVICE_REGISTRATION',
  'DEVICE_AUTHENTICATION',
]);
const outputFieldKindTypes = new Set<string>(['LABEL']);
const flowFieldKindTypes = new Set<string>([
  'SUBMIT_BUTTON',
  'ACTION',
  'FLOW_BUTTON',
  'FLOW_LINK',
]);

/**
 * Resolves the execution mode for a collector type string.
 *
 * @remarks
 * Verified against the DaVinci 2.0.1 iOS/Android sources — no `auto_capable`
 * mode exists. `integration_required` is reserved for plugin packages
 * (e.g. `rn-external-idp`) and is returned only for collector types
 * registered in {@link integrationRequiredCollectorTypes}.
 *
 * @param type - Collector type string from the native bridge.
 * @returns Execution mode classification.
 *
 * @example
 * ```ts
 * resolveExecutionMode('TEXT');          // 'manual'
 * resolveExecutionMode('LABEL');         // 'output_only'
 * resolveExecutionMode('SUBMIT_BUTTON'); // 'immediate'
 * resolveExecutionMode('UNKNOWN_TYPE');  // 'unsupported'
 * ```
 *
 * @public
 */
export function resolveExecutionMode(type: string): DaVinciExecutionMode {
  if (integrationRequiredCollectorTypes.has(type as DaVinciCollector['type'])) {
    return 'integration_required';
  }
  if (manualCollectorTypes.has(type)) {
    return 'manual';
  }
  if (outputOnlyCollectorTypes.has(type)) {
    return 'output_only';
  }
  if (immediateCollectorTypes.has(type)) {
    return 'immediate';
  }
  return 'unsupported';
}

/**
 * Resolves a high-level UI field kind for a collector type string.
 *
 * @remarks
 * Parallels Journey's `resolveFieldKind`. Integration-required collector
 * types resolve to `'integration'`.
 *
 * @param type - Collector type string from the native bridge.
 * @returns Field kind classification.
 *
 * @example
 * ```ts
 * resolveFieldKind('TEXT');          // 'text'
 * resolveFieldKind('PASSWORD');      // 'password'
 * resolveFieldKind('SINGLE_SELECT'); // 'singleSelect'
 * resolveFieldKind('SUBMIT_BUTTON'); // 'flow'
 * resolveFieldKind('LABEL');         // 'output'
 * resolveFieldKind('UNKNOWN_TYPE');  // 'unknown'
 * ```
 *
 * @public
 */
export function resolveFieldKind(type: string): DaVinciFieldKind {
  if (integrationRequiredCollectorTypes.has(type as DaVinciCollector['type'])) {
    return 'integration';
  }
  if (textFieldKindTypes.has(type)) {
    return 'text';
  }
  if (passwordFieldKindTypes.has(type)) {
    return 'password';
  }
  if (singleSelectFieldKindTypes.has(type)) {
    return 'singleSelect';
  }
  if (multiSelectFieldKindTypes.has(type)) {
    return 'multiSelect';
  }
  if (phoneFieldKindTypes.has(type)) {
    return 'phone';
  }
  if (deviceFieldKindTypes.has(type)) {
    return 'device';
  }
  if (outputFieldKindTypes.has(type)) {
    return 'output';
  }
  if (flowFieldKindTypes.has(type)) {
    return 'flow';
  }
  return 'unknown';
}

/**
 * Returns whether a collector with the given execution mode requires
 * direct user input before submission.
 *
 * @param executionMode - Resolved execution mode for the collector.
 * @returns `true` only when `executionMode === 'manual'`.
 */
function resolveRequiresUserInput(
  executionMode: DaVinciExecutionMode,
): boolean {
  return executionMode === 'manual';
}

/**
 * Returns the `required` flag for a collector when present.
 *
 * @remarks
 * `LabelCollector` does not extend `BaseCollector` and has no `required` field.
 *
 * @param collector - Raw collector from the bridge.
 * @returns `required` flag or `false` when absent.
 */
function readRequired(collector: DaVinciCollector): boolean {
  if ('required' in collector) {
    return Boolean(collector.required);
  }
  return false;
}

/**
 * Resolves a server-seeded default value for a collector.
 *
 * @remarks
 * Parallels Journey's `resolveDefaultValue`. Used by `useDaVinciForm` to
 * hydrate form state on first render and after a node switch.
 * Returns `undefined` when the collector has no meaningful seed.
 *
 * @param collector - Raw collector from the bridge.
 * @returns Server-seeded default value or undefined.
 */
function resolveDefaultValue(
  collector: DaVinciCollector,
): DaVinciFormValue | undefined {
  if (multiSelectFieldKindTypes.has(collector.type)) {
    const value = (collector as { value?: unknown }).value;
    return Array.isArray(value) ? (value as string[]) : undefined;
  }

  if (phoneFieldKindTypes.has(collector.type)) {
    const phone = collector as {
      countryCode?: string;
      phoneNumber?: string;
    };
    if (phone.countryCode === undefined && phone.phoneNumber === undefined) {
      return undefined;
    }
    return {
      countryCode: phone.countryCode ?? '',
      phoneNumber: phone.phoneNumber ?? '',
    };
  }

  if (collector.type === 'DEVICE_AUTHENTICATION') {
    const device = (collector as { value?: unknown }).value;
    if (device && typeof device === 'object') {
      return device as { type: string; id?: string; description?: string };
    }
    return undefined;
  }

  if (
    textFieldKindTypes.has(collector.type) ||
    passwordFieldKindTypes.has(collector.type) ||
    singleSelectFieldKindTypes.has(collector.type) ||
    collector.type === 'DEVICE_REGISTRATION'
  ) {
    const value = (collector as { value?: unknown }).value;
    return typeof value === 'string' ? value : undefined;
  }

  return undefined;
}

/**
 * Returns true when a manual collector value satisfies its `required` flag.
 *
 * @param collector - Normalised manual collector.
 * @param value - Candidate form value.
 * @returns True when the value is considered present.
 */
function hasManualValue(
  collector: DaVinciNormalizedCollector,
  value: DaVinciFormValue | undefined,
): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (collector.type === 'PHONE_NUMBER') {
    const phone = value as { countryCode?: string; phoneNumber?: string };
    return Boolean(phone.phoneNumber && phone.phoneNumber.length > 0);
  }

  if (collector.type === 'DEVICE_AUTHENTICATION') {
    const device = value as { type?: string };
    return Boolean(device.type && device.type.length > 0);
  }

  return true;
}

/**
 * Enriches raw bridge collectors with UI-helper metadata.
 *
 * @remarks
 * Adds `executionMode`, `requiresUserInput`, `kind`, `defaultValue`, and
 * passes through `raw` (the server-side field JSON populated by the native
 * mapper).
 *
 * @param collectors - Raw collectors from a {@link ContinueNode}.
 * @returns Collectors enriched with helper metadata.
 *
 * @example
 * ```ts
 * if (node.type === 'ContinueNode') {
 *   const fields = normalizeCollectors(node.collectors);
 *   const textFields = fields.filter((f) => f.kind === 'text');
 * }
 * ```
 *
 * @public
 */
export function normalizeCollectors(
  collectors: DaVinciCollector[],
): DaVinciNormalizedCollector[] {
  return collectors.map((collector) => {
    const executionMode = resolveExecutionMode(collector.type);
    const kind = resolveFieldKind(collector.type);
    const defaultValue = resolveDefaultValue(collector);

    return {
      ...collector,
      executionMode,
      requiresUserInput: resolveRequiresUserInput(executionMode),
      kind,
      defaultValue,
    } as DaVinciNormalizedCollector;
  });
}

/**
 * Builds a `next()` payload from a DaVinci node and form values.
 *
 * @example
 * Basic submit:
 * ```ts
 * const { canSubmit, input, issues } = buildNextInput(node, values);
 * if (canSubmit) {
 *   await client.next(input);
 * }
 * ```
 *
 * @example
 * Flow button (bypasses all other field values):
 * ```ts
 * const { input } = buildNextInput(node, values, undefined, 'forgot-password');
 * await client.next(input);
 * ```
 *
 * @remarks
 * When `flowKey` is provided, the payload contains only that single
 * collector key — all other field values are ignored and no `REQUIRED_VALUE_MISSING`
 * issues are produced. This mirrors how `FlowCollector` advances the flow with
 * `eventType = "action"` on the native side.
 *
 * Integration-required collectors whose type appears in
 * `handledCollectorTypes` are silently skipped; those not in the set emit a
 * non-blocking `INTEGRATION_REQUIRED` issue and force `canSubmit: false`.
 *
 * @param node - Current DaVinci node. Returns a `NO_ACTIVE_CONTINUE_NODE` issue when absent.
 * @param values - Form values keyed by collector key.
 * @param handledCollectorTypes - Collector types the app has already
 *   processed via native integration (e.g. IdP, FIDO, Protect). Matching
 *   `integration_required` collectors are excluded from submit issues so
 *   `canSubmit` reflects true readiness.
 * @param flowKey - Optional FlowCollector key to submit immediately.
 * @returns Submit plan with payload, submit eligibility, and issues.
 *
 * @public
 */
export function buildNextInput(
  node: DaVinciNode | null | undefined,
  values: DaVinciFormValues,
  handledCollectorTypes?: ReadonlySet<string>,
  flowKey?: string,
): DaVinciBuildNextInputResult {
  if (!node || node.type !== 'ContinueNode') {
    return {
      canSubmit: false,
      input: { collectors: [] },
      issues: [
        {
          code: 'NO_ACTIVE_CONTINUE_NODE',
          message: 'No active ContinueNode. Call start() first.',
        },
      ],
    };
  }

  const collectors = normalizeCollectors(node.collectors);

  if (flowKey !== undefined) {
    const target = collectors.find((collector) => collector.key === flowKey);
    const input: DaVinciNextInput = {
      collectors: [
        {
          key: flowKey,
          value: target ? (values[flowKey] ?? flowKey) : flowKey,
        },
      ],
    };
    return {
      canSubmit: true,
      input,
      issues: [],
    };
  }

  const payload: DaVinciCollectorInput[] = [];
  const issues: DaVinciSubmitIssue[] = [];

  // Track whether we've added a SUBMIT_BUTTON to the payload. The native SDK
  // requires the SubmitCollector's value to be non-empty so that actionKey and
  // eventType are included in the POST body. We include only the first one.
  let submitButtonAdded = false;

  collectors.forEach((collector) => {
    if (collector.executionMode === 'output_only') {
      return;
    }

    if (collector.executionMode === 'integration_required') {
      if (!handledCollectorTypes?.has(collector.type)) {
        issues.push({
          code: 'INTEGRATION_REQUIRED',
          message: `Collector "${collector.type}" requires additional integration.`,
          key: collector.key,
        });
      }
      return;
    }

    if (collector.executionMode === 'immediate') {
      // SUBMIT_BUTTON must be included so the native SDK sets actionKey and
      // eventType in the POST body. ACTION, FLOW_BUTTON, and FLOW_LINK are
      // flow-navigation triggers handled via submitFlow() — skip them here.
      if (collector.type === 'SUBMIT_BUTTON' && !submitButtonAdded) {
        payload.push({ key: collector.key, value: collector.key });
        submitButtonAdded = true;
      }
      return;
    }

    if (collector.executionMode === 'unsupported') {
      issues.push({
        code: 'UNSUPPORTED_COLLECTOR',
        message: `Collector type "${collector.type}" is not supported by the helper submit builder.`,
        key: collector.key,
      });
      return;
    }

    const value = values[collector.key];
    const required = readRequired(collector);
    if (required && !hasManualValue(collector, value)) {
      issues.push({
        code: 'REQUIRED_VALUE_MISSING',
        message: `Collector "${collector.key}" requires a value to continue.`,
        key: collector.key,
      });
      return;
    }

    if (value === undefined) {
      return;
    }

    payload.push({ key: collector.key, value });
  });

  const blocking = issues.some(
    (issue) =>
      issue.code === 'REQUIRED_VALUE_MISSING' ||
      issue.code === 'INTEGRATION_REQUIRED',
  );

  return {
    canSubmit: !blocking,
    input: { collectors: payload },
    issues,
  };
}

/**
 * Derives aggregate form metadata from a normalised collector list.
 *
 * @param collectors - Normalised collectors for the active form.
 * @returns Form-level execution metadata.
 *
 * @example
 * ```ts
 * const fields = normalizeCollectors(node.collectors);
 * const meta = computeFormMeta(fields);
 * if (!meta.hasManual && !meta.hasIntegrationRequired) {
 *   // All collectors are output-only or immediate — auto-submit is safe.
 * }
 * ```
 *
 * @public
 */
export function computeFormMeta(
  collectors: DaVinciNormalizedCollector[],
): DaVinciFormMeta {
  return {
    hasManual: collectors.some((c) => c.executionMode === 'manual'),
    hasOutputOnly: collectors.some((c) => c.executionMode === 'output_only'),
    // No `auto_capable` execution mode exists in the DaVinci 2.0.1 SDKs — see
    // DaVinciFormMeta.hasAutoCapable remarks. Always false until a future
    // collector type is registered for that mode.
    hasAutoCapable: false,
    hasIntegrationRequired: collectors.some(
      (c) => c.executionMode === 'integration_required',
    ),
    hasUnsupported: collectors.some((c) => c.executionMode === 'unsupported'),
  };
}

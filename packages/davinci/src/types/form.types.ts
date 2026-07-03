/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import type { DaVinciNextInput } from './config.types';
import type { DaVinciCollector, DaVinciNode } from './node.types';

/**
 * Headless collector form helper type contracts.
 */

/**
 * Collector execution mode — controls how the UI should treat this collector.
 *
 * @remarks
 * - `manual`               — collector requires explicit user input (TEXT, PASSWORD,
 *                            SINGLE_SELECT, MULTI_SELECT, PHONE_NUMBER,
 *                            DEVICE_REGISTRATION, DEVICE_AUTHENTICATION, etc.)
 * - `output_only`          — display-only collector, no user input (LABEL)
 * - `immediate`            — activating the collector immediately advances the flow
 *                            without waiting for other field values
 *                            (SUBMIT_BUTTON, ACTION, FLOW_BUTTON, FLOW_LINK)
 * - `integration_required` — collector is handled entirely by an external package
 *                            (e.g. `rn-external-idp` driving `IdpCollector`).
 *                            The bridge serialises the collector data; the external
 *                            package performs its action and then calls `next()`.
 *                            No base-registry collector maps to this mode in 2.0.1 —
 *                            plugin collectors registered by future packages will.
 * - `unsupported`          — collector type not recognised by the bridge or any
 *                            registered integration; skipped in the submit payload
 *
 * No `auto_capable` exists — every collector requires an explicit user gesture or
 * an external-package action.
 *
 * @public
 */
export type DaVinciExecutionMode =
  | 'manual'
  | 'output_only'
  | 'immediate'
  | 'integration_required'
  | 'unsupported';

/**
 * High-level field kind for DaVinci collectors, used by headless form helpers.
 *
 * @remarks
 * Parallels {@link JourneyFieldKind} from the Journey package.
 * - `text`         — single-line text input (TEXT, HIDDEN)
 * - `password`     — masked password input (PASSWORD, PASSWORD_VERIFY)
 * - `singleSelect` — single-select input (SINGLE_SELECT, DROPDOWN, RADIO)
 * - `multiSelect`  — multi-select input (MULTI_SELECT, COMBOBOX, CHECKBOX)
 * - `phone`        — phone number input (PHONE_NUMBER)
 * - `device`       — device picker (DEVICE_REGISTRATION, DEVICE_AUTHENTICATION)
 * - `output`       — display-only content (LABEL)
 * - `flow`         — immediate-submit action (SUBMIT_BUTTON, ACTION, FLOW_BUTTON, FLOW_LINK)
 * - `integration`  — handled by an external integration package (future collectors)
 * - `unknown`      — unrecognised type
 *
 * @public
 */
export type DaVinciFieldKind =
  | 'text'
  | 'password'
  | 'singleSelect'
  | 'multiSelect'
  | 'phone'
  | 'device'
  | 'output'
  | 'flow'
  | 'integration'
  | 'unknown';

/**
 * Collector enriched with UI-helper metadata.
 *
 * @remarks
 * Extends the raw {@link DaVinciCollector} from the bridge with derived fields.
 *
 * @public
 */
export type DaVinciNormalizedCollector = DaVinciCollector & {
  /** Execution mode classification for this collector. */
  executionMode: DaVinciExecutionMode;
  /**
   * Whether this collector requires direct user input before submission.
   *
   * @remarks
   * `true` only when `executionMode === 'manual'`; `false` for `output_only`,
   * `immediate`, `integration_required`, and `unsupported`.
   * Integration-required collectors are handled by an external package, not by
   * direct user input into the form.
   */
  requiresUserInput: boolean;
  /**
   * UI-oriented field kind resolved from the collector type.
   *
   * @remarks
   * Parallels `kind` on {@link JourneyNormalizedField}.
   */
  kind: DaVinciFieldKind;
  /**
   * Server-seeded default value for this collector, when present.
   *
   * @remarks
   * Parallels `defaultValue` on {@link JourneyNormalizedField}. Used by
   * `useDaVinciForm` to hydrate form state on first render and after a node
   * switch.
   */
  defaultValue?: DaVinciFormValue;
};

/**
 * Flat form value union covering all manual collector value shapes.
 *
 * @public
 */
export type DaVinciFormValue =
  | string // TEXT, PASSWORD, SINGLE_SELECT, DEVICE_REGISTRATION (type string)
  | string[] // MULTI_SELECT
  | { countryCode: string; phoneNumber: string } // PHONE_NUMBER
  | { type: string; id?: string; description?: string } // DEVICE_AUTHENTICATION
  | null;

/**
 * Form value map keyed by collector key.
 *
 * @public
 */
export type DaVinciFormValues = Record<string, DaVinciFormValue | undefined>;

/**
 * Stable issue code surfaced by the collector submit helper.
 *
 * @public
 */
export type DaVinciSubmitIssueCode =
  | 'NO_ACTIVE_CONTINUE_NODE'
  | 'REQUIRED_VALUE_MISSING'
  | 'UNSUPPORTED_COLLECTOR'
  | 'INTEGRATION_REQUIRED';

/**
 * Helper issue record for collector submit planning.
 *
 * @public
 */
export type DaVinciSubmitIssue = {
  /** Stable issue code. */
  code: DaVinciSubmitIssueCode;
  /** Human-readable issue message for UI display. */
  message: string;
  /** Optional collector key associated with the issue. */
  key?: string;
};

/**
 * Result shape returned by the collector submit builder helper.
 *
 * @public
 */
export type DaVinciBuildNextInputResult = {
  /** Whether `input` can be safely submitted to `next()`. */
  canSubmit: boolean;
  /** Collector payload built from normalised fields and form values. */
  input: DaVinciNextInput;
  /** Blocking and non-blocking issues found while building the payload. */
  issues: DaVinciSubmitIssue[];
};

/**
 * Derived metadata for the active form — used to drive UI-level decisions
 * (e.g. hide a form that only has output/immediate collectors).
 *
 * @public
 */
export type DaVinciFormMeta = {
  /** True when at least one collector requires manual user input. */
  hasManual: boolean;
  /** True when at least one `LABEL` (output-only) collector is present. */
  hasOutputOnly: boolean;
  /**
   * True when at least one collector requires an external package integration
   * (e.g. `rn-external-idp` handling an `IdpCollector`).
   */
  hasIntegrationRequired: boolean;
  /** True when at least one unsupported (unknown-type) collector is present. */
  hasUnsupported: boolean;
};

/**
 * Updater argument accepted by `setValues` in {@link useDaVinci} and {@link useDaVinciForm}.
 *
 * @public
 */
export type DaVinciFormValuesUpdater =
  | Partial<DaVinciFormValues>
  | ((previous: DaVinciFormValues) => Partial<DaVinciFormValues>);

/**
 * Options accepted by {@link useDaVinciForm}.
 *
 * @public
 */
export type DaVinciFormOptions = {
  /**
   * Collector types that the app has already handled via native integration
   * (for example IdP, FIDO, or Protect). When provided, matching
   * `integration_required` collectors are excluded from submit issues so that
   * `canSubmit` reflects true readiness.
   */
  handledCollectorTypes?: ReadonlySet<string>;
  /**
   * Optional `next` function from `useDaVinci(client)`.
   *
   * @remarks
   * Required when `useDaVinciForm` is used outside a `<DaVinciProvider>`.
   * When omitted, `submitFlow` falls back to the provider context's `next`.
   * If neither is available, `submitFlow` throws a `DaVinciError`.
   */
  next?: (input: DaVinciNextInput) => Promise<DaVinciNode>;
};

/**
 * Return contract for {@link useDaVinciForm}.
 *
 * @remarks
 * Parallels {@link JourneyFormResult} from the Journey package. `fields` replaces
 * the older `collectors` name for parity with Journey.
 *
 * @public
 */
export type DaVinciFormResult = {
  /**
   * Normalized collector fields for the active {@link ContinueNode}.
   */
  fields: DaVinciNormalizedCollector[];
  /**
   * Current form value map keyed by collector key.
   */
  values: DaVinciFormValues;
  /**
   * Submit payload derived from `node + values`.
   */
  input: DaVinciNextInput;
  /**
   * Indicates whether `input` can be safely submitted.
   */
  canSubmit: boolean;
  /**
   * Planning issues detected for the current submit payload.
   */
  issues: DaVinciSubmitIssue[];
  /**
   * Derived collector execution metadata.
   */
  meta: DaVinciFormMeta;
  /**
   * Sets one collector field value.
   *
   * @param key - Collector key.
   * @param value - New field value.
   */
  setValue: (key: string, value: DaVinciFormValue) => void;
  /**
   * Merges one or more collector field values.
   *
   * @param updater - Static patch object or updater function.
   */
  setValues: (updater: DaVinciFormValuesUpdater) => void;
  /**
   * Removes one collector field value from form state.
   *
   * @param key - Collector key.
   */
  clearValue: (key: string) => void;
  /**
   * Resets the full value map and reapplies collector-provided defaults.
   *
   * @param nextValues - Optional reset base values.
   */
  reset: (nextValues?: DaVinciFormValues) => void;
  /**
   * Builds a fresh submit plan for the current node and optional value overrides.
   *
   * @param overrides - Value overrides applied on top of current values.
   * @returns Submit planning result.
   */
  buildInput: (
    overrides?: Partial<DaVinciFormValues>,
  ) => DaVinciBuildNextInputResult;
  /**
   * Returns one normalized collector field by key.
   *
   * @param key - Collector key.
   * @returns Matching field or undefined.
   */
  getField: (key: string) => DaVinciNormalizedCollector | undefined;
  /**
   * Returns all normalized collector fields for a given type string.
   *
   * @param type - Collector type string.
   * @returns Ordered list of matching normalized fields.
   */
  getFieldsByType: (type: string) => DaVinciNormalizedCollector[];
  /**
   * Returns one normalized collector field by type string and per-type index.
   *
   * @param type - Collector type string.
   * @param typeIndex - Optional zero-based index within the type group (defaults to 0).
   * @returns Matching field or undefined.
   */
  getFieldByType: (
    type: string,
    typeIndex?: number,
  ) => DaVinciNormalizedCollector | undefined;
  /**
   * Sets one field value using collector type string and optional index.
   *
   * @param type - Collector type string.
   * @param value - New field value.
   * @param typeIndex - Optional zero-based index within the type group (defaults to 0).
   * @returns True when a matching field was found and updated.
   */
  setValueByType: (
    type: string,
    value: DaVinciFormValue,
    typeIndex?: number,
  ) => boolean;
  /**
   * Submits a {@link FlowCollector} by key, bypassing all other field values.
   *
   * @param flowKey - Flow collector key.
   * @returns Next flow node.
   * @throws {DaVinciError} When progression fails.
   */
  submitFlow: (flowKey: string) => Promise<DaVinciNode>;
};

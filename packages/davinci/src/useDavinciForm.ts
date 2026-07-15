/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  buildNextInput,
  computeFormMeta,
  flowCollectorTypes,
  normalizeCollectors,
} from './collectorHelpers';
import { DaVinciError } from './types/error.types';
import { useDaVinciContext } from './useDavinci';
import type {
  DaVinciBuildNextInputResult,
  DaVinciFormMeta,
  DaVinciFormOptions,
  DaVinciFormResult,
  DaVinciFormValue,
  DaVinciFormValues,
  DaVinciFormValuesUpdater,
  DaVinciNextInput,
  DaVinciNode,
  DaVinciNormalizedCollector,
} from './types';

/**
 * Caches normalized collector fields by DaVinci node object identity.
 *
 * @remarks
 * `WeakMap` keeps this cache GC-safe so stale node entries are released
 * automatically when node objects are no longer referenced.
 */
const normalizedFieldCache = new WeakMap<
  DaVinciNode,
  DaVinciNormalizedCollector[]
>();

/**
 * Resolves normalized collector fields with node-identity caching.
 *
 * @remarks
 * Returns an empty array for any node that is not an active `ContinueNode`
 * (e.g. `SuccessNode`, `ErrorNode`, or `null`) since only `ContinueNode`
 * carries collectors to normalize.
 *
 * @param node - Current DaVinci node.
 * @returns Normalized collector fields.
 *
 * @example
 * ```ts
 * const fields = getNormalizedFields(node);
 * // Same node object on the next render reuses the cached array instead of
 * // recomputing normalizeCollectors(node.collectors).
 * ```
 */
function getNormalizedFields(
  node: DaVinciNode | null | undefined,
): DaVinciNormalizedCollector[] {
  if (!node || node.type !== 'ContinueNode') {
    return [];
  }

  const cached = normalizedFieldCache.get(node);
  if (cached) {
    return cached;
  }

  const normalized = normalizeCollectors(node.collectors);
  normalizedFieldCache.set(node, normalized);
  return normalized;
}

/**
 * Applies collector-default seeding over a base value map.
 *
 * @remarks
 * Only fills in a field's `defaultValue` when `baseValues` has no existing
 * entry for that key — an explicit `undefined` in `baseValues` still counts
 * as "not set" and will be hydrated. Used both on first render (empty
 * `baseValues`) and by `reset()` (caller-supplied `baseValues`).
 *
 * @param fields - Normalized collector fields.
 * @param baseValues - Existing values.
 * @returns Hydrated value map.
 *
 * @example
 * ```ts
 * // Collector "email" has a server-seeded defaultValue of "a@b.com".
 * hydrateValues(fields, {}); // => { email: 'a@b.com' }
 * hydrateValues(fields, { email: 'typed@b.com' }); // => { email: 'typed@b.com' }
 * ```
 */
function hydrateValues(
  fields: DaVinciNormalizedCollector[],
  baseValues: DaVinciFormValues,
): DaVinciFormValues {
  const nextValues: DaVinciFormValues = { ...baseValues };
  fields.forEach((field) => {
    if (nextValues[field.key] !== undefined) {
      return;
    }
    if (field.defaultValue !== undefined) {
      nextValues[field.key] = field.defaultValue;
    }
  });
  return nextValues;
}

/**
 * Compares two value maps for shallow equality.
 *
 * @remarks
 * Used by `setValues` and `reset` to bail out of a state update (and the
 * resulting re-render) when the computed next value map is identical to the
 * previous one.
 *
 * @param previous - Previous map.
 * @param next - Next map.
 * @returns True when both maps contain identical keys and values.
 *
 * @example
 * ```ts
 * isSameValueMap({ email: 'a' }, { email: 'a' }); // true
 * isSameValueMap({ email: 'a' }, { email: 'b' }); // false
 * isSameValueMap({ email: 'a' }, { email: 'a', phone: '1' }); // false
 * ```
 */
function isSameValueMap(
  previous: DaVinciFormValues,
  next: DaVinciFormValues,
): boolean {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) {
    return false;
  }
  return previousKeys.every((key) => previous[key] === next[key]);
}

/**
 * Headless collector form helper for DaVinci nodes.
 *
 * @remarks
 * Manages collector form state and submit planning for the active DaVinci node.
 * Pair with {@link useDaVinci} (or {@link DaVinciProvider}) for flow navigation.
 *
 * Whenever `node` changes identity (e.g. after `next()` resolves to a new
 * `ContinueNode`), the form automatically resets its value map and reseeds
 * collector defaults for the new node's fields — you do not need to call
 * `reset()` manually on navigation.
 *
 * Tapping a {@link FlowCollector} (`ACTION`, `FLOW_BUTTON`, `FLOW_LINK`) via
 * `setValue`/`setValueByType` immediately calls `next()` with only that
 * key, bypassing all other field values — no manual `next()` call required.
 * `submitFlow` is the explicit equivalent for flow keys not wired to a
 * `setValue` call directly.
 *
 * @example
 * Basic usage with an explicit client:
 * ```ts
 * const { node, next } = useDaVinci(client);
 * const form = useDaVinciForm(node);
 *
 * form.setValueByType('TEXT', 'alice');
 * if (form.canSubmit) {
 *   await next(form.input);
 * }
 * ```
 *
 * @example
 * Inside a `<DaVinciProvider>`, `next` is resolved from context, so tapping
 * a FlowCollector via `setValue` auto-submits without any extra wiring:
 * ```ts
 * const { node } = useDaVinci();
 * const form = useDaVinciForm(node);
 *
 * // "forgotPassword" is a FLOW_BUTTON collector key — setValue advances the
 * // flow immediately, bypassing form.values entirely.
 * await form.setValue('forgotPassword', 'forgotPassword');
 * ```
 *
 * @example
 * Rendering fields by kind, independent of the exact collector type:
 * ```ts
 * const form = useDaVinciForm(node);
 *
 * form.fields.map((field) => {
 *   switch (field.kind) {
 *     case 'text':
 *       return (
 *         <TextInput
 *           key={field.key}
 *           value={(form.values[field.key] as string) ?? ''}
 *           onChangeText={(text) => form.setValue(field.key, text)}
 *         />
 *       );
 *     case 'password':
 *       return (
 *         <TextInput
 *           key={field.key}
 *           secureTextEntry
 *           value={(form.values[field.key] as string) ?? ''}
 *           onChangeText={(text) => form.setValue(field.key, text)}
 *         />
 *       );
 *     default:
 *       return null;
 *   }
 * });
 * ```
 *
 * @example
 * Passing `next` explicitly when used outside a `<DaVinciProvider>` —
 * required for `submitFlow` to work in that setup:
 * ```ts
 * const { node, next } = useDaVinci(client);
 * const form = useDaVinciForm(node, { next });
 * await form.submitFlow('forgotPassword');
 * ```
 *
 * @param node - Current DaVinci node from `useDaVinci`.
 * @param options - Optional form options (e.g. `handledCollectorTypes`).
 * @returns Normalized fields, managed values, and submit planning helpers.
 *
 * @public
 */
export function useDaVinciForm(
  node: DaVinciNode | null | undefined,
  options: DaVinciFormOptions = {},
): DaVinciFormResult {
  const contextValue = useDaVinciContext();

  const fields = useMemo<DaVinciNormalizedCollector[]>(
    () => getNormalizedFields(node),
    [node],
  );

  const fieldsByKey = useMemo<Map<string, DaVinciNormalizedCollector>>(
    () => new Map(fields.map((field) => [field.key, field])),
    [fields],
  );

  const fieldsByType = useMemo<
    Map<string, DaVinciNormalizedCollector[]>
  >(() => {
    const byType = new Map<string, DaVinciNormalizedCollector[]>();
    fields.forEach((field) => {
      const existing = byType.get(field.type);
      if (existing) {
        existing.push(field);
        return;
      }
      byType.set(field.type, [field]);
    });
    return byType;
  }, [fields]);

  const [prevFields, setPrevFields] = useState(fields);
  const [values, setValuesState] = useState<DaVinciFormValues>(() =>
    hydrateValues(fields, {}),
  );

  // Adjust state during render when fields change (node switch resets form values).
  if (prevFields !== fields) {
    setPrevFields(fields);
    setValuesState(hydrateValues(fields, {}));
  }

  const submitPlan = useMemo<DaVinciBuildNextInputResult>(
    () => buildNextInput(node, values, options.handledCollectorTypes),
    [node, values, options.handledCollectorTypes],
  );

  const meta = useMemo<DaVinciFormMeta>(
    () => computeFormMeta(fields),
    [fields],
  );

  // Resolves `next` from options.next first, then falls back to the
  // DaVinciProvider context — shared by submitFlow() and the FlowCollector
  // auto-submit path in setValue()/setValueByType().
  const resolveNext = useCallback((): ((
    input: DaVinciNextInput,
  ) => Promise<DaVinciNode>) => {
    return (
      options.next ??
      contextValue?.davinci.next ??
      (() => {
        throw new DaVinciError(
          'No DaVinci client found. Use useDaVinciForm inside a DaVinciProvider or pass next from useDaVinci(client) via options.',
          'DAVINCI_STATE_ERROR',
          'state_error',
        );
      })
    );
  }, [options.next, contextValue]);

  // Submits a FlowCollector (e.g. "Forgot password?", "Sign up instead")
  // immediately, ignoring all other collector values in `values` — mirrors
  // how the native SDK advances via eventType = "action".
  const submitFlowKey = useCallback(
    async (
      flowKey: string,
      overrideValue?: DaVinciFormValue,
    ): Promise<DaVinciNode> => {
      const davinciNext = resolveNext();
      const flowValues =
        overrideValue === undefined
          ? values
          : { ...values, [flowKey]: overrideValue };
      const plan = buildNextInput(node, flowValues, undefined, flowKey);
      return await davinciNext(plan.input);
    },
    [resolveNext, node, values],
  );

  // e.g. setValue('email', 'a@b.com') stores under the collector's own key.
  // No-op (skips the state update) when the new value is referentially equal
  // to the current one, avoiding an unnecessary re-render.
  //
  // FlowCollector auto-submit: setting a value on a FlowCollector key
  // (ACTION, FLOW_BUTTON, FLOW_LINK) immediately calls next() with that key,
  // bypassing all other field values — the developer does not need to call
  // next(form.input) manually. Returns the pending submit Promise so callers
  // that need to await/catch the navigation can do so; callers that don't
  // care can ignore the return value.
  const setValue = useCallback(
    (key: string, value: DaVinciFormValue): void | Promise<DaVinciNode> => {
      const field = fieldsByKey.get(key);
      if (field && flowCollectorTypes.has(field.type)) {
        return submitFlowKey(key, value);
      }
      setValuesState((previous) => {
        if (previous[key] === value) {
          return previous;
        }
        return { ...previous, [key]: value };
      });
      return undefined;
    },
    [fieldsByKey, submitFlowKey],
  );

  // Accepts either a static patch object or an updater function that reads
  // the previous values, e.g.:
  //   form.setValues({ email: 'a@b.com', password: 'secret' });
  //   form.setValues((prev) => ({ confirmPassword: prev.password }));
  // Existing keys not present in the patch are left untouched.
  const setValues = useCallback((updater: DaVinciFormValuesUpdater): void => {
    setValuesState((previous) => {
      const patch = typeof updater === 'function' ? updater(previous) : updater;
      const nextValues: DaVinciFormValues = { ...previous, ...patch };
      return isSameValueMap(previous, nextValues) ? previous : nextValues;
    });
  }, []);

  // Deletes the key entirely (distinct from setValue(key, undefined), which
  // would keep the key present with an undefined value). Useful for
  // "un-answering" an optional field, e.g. form.clearValue('middleName').
  const clearValue = useCallback((key: string): void => {
    setValuesState((previous) => {
      if (!(key in previous)) {
        return previous;
      }
      const nextValues = { ...previous };
      delete nextValues[key];
      return nextValues;
    });
  }, []);

  // Replaces the full value map with `nextValues`, then reseeds any
  // collector defaults missing from it — same hydration `useDaVinciForm`
  // performs on first render and on node switch. Call with no arguments to
  // fully clear a form back to server defaults, e.g. after a validation
  // error: `form.reset()`. Pass a partial map to reset while keeping
  // specific fields: `form.reset({ email: form.values.email })`.
  const reset = useCallback(
    (nextValues: DaVinciFormValues = {}): void => {
      setValuesState((previous) => {
        const hydrated = hydrateValues(fields, { ...nextValues });
        return isSameValueMap(previous, hydrated) ? previous : hydrated;
      });
    },
    [fields],
  );

  // Previews a submit plan without committing `overrides` to form state —
  // useful for validating a value before calling setValue, e.g.:
  //   const preview = form.buildInput({ email: candidateEmail });
  //   if (preview.canSubmit) form.setValue('email', candidateEmail);
  const buildInput = useCallback(
    (overrides: Partial<DaVinciFormValues> = {}): DaVinciBuildNextInputResult =>
      buildNextInput(
        node,
        { ...values, ...overrides },
        options.handledCollectorTypes,
      ),
    [node, values, options.handledCollectorTypes],
  );

  // e.g. form.getField('email')?.kind === 'text'
  const getField = useCallback(
    (key: string): DaVinciNormalizedCollector | undefined =>
      fieldsByKey.get(key),
    [fieldsByKey],
  );

  // e.g. a node with two CHECKBOX collectors of the same type:
  //   form.getFieldsByType('CHECKBOX'); // => [termsField, marketingField]
  const getFieldsByType = useCallback(
    (type: string): DaVinciNormalizedCollector[] =>
      fieldsByType.get(type) ?? [],
    [fieldsByType],
  );

  // `typeIndex` disambiguates nodes with multiple collectors sharing a type,
  // e.g. two PASSWORD fields (new + confirm):
  //   form.getFieldByType('PASSWORD', 0); // new password field
  //   form.getFieldByType('PASSWORD', 1); // confirm password field
  const getFieldByType = useCallback(
    (type: string, typeIndex = 0): DaVinciNormalizedCollector | undefined => {
      if (typeIndex < 0) {
        return undefined;
      }
      return fieldsByType.get(type)?.[typeIndex];
    },
    [fieldsByType],
  );

  // Shorthand for getFieldByType + setValue, returning false when no field
  // matches the type/index so callers can detect a no-op, e.g.:
  //   const applied = form.setValueByType('TEXT', 'alice');
  //   if (!applied) { /* node has no TEXT collector */ }
  const setValueByType = useCallback(
    (type: string, value: DaVinciFormValue, typeIndex = 0): boolean => {
      const field = getFieldByType(type, typeIndex);
      if (!field) {
        return false;
      }
      setValue(field.key, value);
      return true;
    },
    [getFieldByType, setValue],
  );

  // Explicit variant of the FlowCollector auto-submit performed by setValue()
  // — useful when the flow key isn't wired to setValue directly, e.g.:
  //   await form.submitFlow('forgotPassword');
  const submitFlow = useCallback(
    (flowKey: string): Promise<DaVinciNode> => submitFlowKey(flowKey),
    [submitFlowKey],
  );

  return {
    fields,
    values,
    input: submitPlan.input,
    canSubmit: submitPlan.canSubmit,
    issues: submitPlan.issues,
    meta,
    setValue,
    setValues,
    clearValue,
    reset,
    buildInput,
    getField,
    getFieldsByType,
    getFieldByType,
    setValueByType,
    submitFlow,
  };
}

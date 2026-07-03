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
 * @param node - Current DaVinci node.
 * @returns Normalized collector fields.
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
 * @param fields - Normalized collector fields.
 * @param baseValues - Existing values.
 * @returns Hydrated value map.
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
 * @param previous - Previous map.
 * @param next - Next map.
 * @returns True when both maps contain identical keys and values.
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
 * @example
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

  const setValue = useCallback((key: string, value: DaVinciFormValue): void => {
    setValuesState((previous) => {
      if (previous[key] === value) {
        return previous;
      }
      return { ...previous, [key]: value };
    });
  }, []);

  const setValues = useCallback((updater: DaVinciFormValuesUpdater): void => {
    setValuesState((previous) => {
      const patch = typeof updater === 'function' ? updater(previous) : updater;
      const nextValues: DaVinciFormValues = { ...previous, ...patch };
      return isSameValueMap(previous, nextValues) ? previous : nextValues;
    });
  }, []);

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

  const reset = useCallback(
    (nextValues: DaVinciFormValues = {}): void => {
      setValuesState((previous) => {
        const hydrated = hydrateValues(fields, { ...nextValues });
        return isSameValueMap(previous, hydrated) ? previous : hydrated;
      });
    },
    [fields],
  );

  const buildInput = useCallback(
    (overrides: Partial<DaVinciFormValues> = {}): DaVinciBuildNextInputResult =>
      buildNextInput(
        node,
        { ...values, ...overrides },
        options.handledCollectorTypes,
      ),
    [node, values, options.handledCollectorTypes],
  );

  const getField = useCallback(
    (key: string): DaVinciNormalizedCollector | undefined =>
      fieldsByKey.get(key),
    [fieldsByKey],
  );

  const getFieldsByType = useCallback(
    (type: string): DaVinciNormalizedCollector[] =>
      fieldsByType.get(type) ?? [],
    [fieldsByType],
  );

  const getFieldByType = useCallback(
    (type: string, typeIndex = 0): DaVinciNormalizedCollector | undefined => {
      if (typeIndex < 0) {
        return undefined;
      }
      return fieldsByType.get(type)?.[typeIndex];
    },
    [fieldsByType],
  );

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

  const submitFlow = useCallback(
    async (flowKey: string): Promise<DaVinciNode> => {
      const davinciNext =
        options.next ??
        contextValue?.davinci.next ??
        (() => {
          throw new DaVinciError(
            'No DaVinci client found. Use useDaVinciForm inside a DaVinciProvider or pass next from useDaVinci(client) via options.',
            'DAVINCI_STATE_ERROR',
            'state_error',
          );
        });
      const plan = buildNextInput(node, values, undefined, flowKey);
      return await davinciNext(plan.input);
    },
    [options.next, contextValue, node, values],
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

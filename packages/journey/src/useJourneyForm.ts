/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildNextInput, normalizeCallbacks } from './callbackHelpers';
import type {
  JourneyBuildNextInputResult,
  JourneyFormMeta,
  JourneyFormResult,
  JourneyFormValue,
  JourneyFormValues,
  JourneyFormValuesUpdater,
  JourneyNode,
  JourneyNormalizedField,
  JourneySubmitIssue,
} from './types';

/**
 * Resolves a seeded value for one field.
 *
 * @param field - Normalized field.
 * @returns Seed value when one should be applied.
 */
function resolveSeedValue(
  field: JourneyNormalizedField
): JourneyFormValue | undefined {
  return field.defaultValue;
}

/**
 * Applies callback-default seeding over a base value map.
 *
 * @param fields - Normalized fields.
 * @param baseValues - Existing values.
 * @returns Hydrated value map.
 */
function hydrateValues(
  fields: JourneyNormalizedField[],
  baseValues: JourneyFormValues
): JourneyFormValues {
  const nextValues: JourneyFormValues = { ...baseValues };
  fields.forEach((field) => {
    if (nextValues[field.id] !== undefined) {
      return;
    }
    const seed = resolveSeedValue(field);
    if (seed !== undefined) {
      nextValues[field.id] = seed;
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
function isSameValueMap(previous: JourneyFormValues, next: JourneyFormValues): boolean {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) {
    return false;
  }

  return previousKeys.every((key) => previous[key] === next[key]);
}

/**
 * Derives aggregate callback capability metadata from fields/issues.
 *
 * @param fields - Normalized callback fields.
 * @param issues - Submit issues from helper planning.
 * @returns Form metadata.
 */
function deriveMeta(fields: JourneyNormalizedField[], issues: JourneySubmitIssue[]): JourneyFormMeta {
  return {
    hasManual: fields.some((field) => field.capability === 'manual'),
    hasOutputOnly: fields.some((field) => field.capability === 'output_only'),
    hasIntegrationRequired: fields.some(
      (field) => field.capability === 'integration_required'
    ),
    hasUnsupported: fields.some((field) => field.capability === 'unsupported'),
    hasRequiredConsentMissing: issues.some(
      (issue) => issue.code === 'REQUIRED_CONSENT_MISSING'
    ),
  };
}

/**
 * Headless callback form helper for Journey nodes.
 *
 * @remarks
 * This hook does not render UI or auto-execute integration-specific callbacks.
 * It only manages callback form state and submit planning.
 *
 * @param node - Current Journey node from `useJourney`.
 * @returns Normalized fields, managed values, and submit planning helpers.
 */
export function useJourneyForm(
  node: JourneyNode | null | undefined
): JourneyFormResult {
  const fields = useMemo<JourneyNormalizedField[]>(
    () => normalizeCallbacks(node),
    [node]
  );

  const [values, setValuesState] = useState<JourneyFormValues>(() =>
    hydrateValues(fields, {})
  );

  useEffect(() => {
    setValuesState((previous) => {
      const hydrated = hydrateValues(fields, {});
      return isSameValueMap(previous, hydrated) ? previous : hydrated;
    });
  }, [fields]);

  const submitPlan = useMemo<JourneyBuildNextInputResult>(
    () => buildNextInput(node, values),
    [node, values]
  );

  const meta = useMemo<JourneyFormMeta>(
    () => deriveMeta(fields, submitPlan.issues),
    [fields, submitPlan.issues]
  );

  const setValue = useCallback((fieldId: string, value: JourneyFormValue): void => {
    setValuesState((previous) => ({
      ...previous,
      [fieldId]: value,
    }));
  }, []);

  const setValues = useCallback((updater: JourneyFormValuesUpdater): void => {
    setValuesState((previous) => {
      const patch =
        typeof updater === 'function'
          ? updater(previous)
          : updater;
      return {
        ...previous,
        ...patch,
      };
    });
  }, []);

  const clearValue = useCallback((fieldId: string): void => {
    setValuesState((previous) => {
      if (!(fieldId in previous)) {
        return previous;
      }
      const nextValues = { ...previous };
      delete nextValues[fieldId];
      return nextValues;
    });
  }, []);

  const reset = useCallback((nextValues: JourneyFormValues = {}): void => {
    setValuesState(hydrateValues(fields, { ...nextValues }));
  }, [fields]);

  const buildInput = useCallback(
    (overrides: Partial<JourneyFormValues> = {}): JourneyBuildNextInputResult => {
      return buildNextInput(node, {
        ...values,
        ...overrides,
      });
    },
    [node, values]
  );

  const getField = useCallback((fieldId: string): JourneyNormalizedField | undefined => {
    return fields.find((field) => field.id === fieldId);
  }, [fields]);

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
  };
}

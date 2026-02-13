/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import type { CallbackEntry, InputValues } from '../utils/callbacks';
import { callbackKey } from '../utils/callbacks';
import { renderCallbackEntry } from '../renderers/registry';
import type { CallbackFormContext, CallbackRenderContext } from '../renderers/types';

/**
 * Props for the callback-driven Journey form renderer.
 */
export type JourneyCallbackFormProps = CallbackFormContext & {
  callbackEntries: CallbackEntry[];
  inputValues: InputValues;
  setInputValues: React.Dispatch<React.SetStateAction<InputValues>>;
};

/**
 * Renders a ContinueNode form from typed callback entries.
 *
 * @param props - Form render props and actions.
 * @returns Callback form markup.
 */
export default function JourneyCallbackForm(
  props: JourneyCallbackFormProps
): React.ReactElement {
  const {
    callbackEntries,
    inputValues,
    setInputValues,
    loading,
    autoSubmitting,
    resumeUrl,
    setResumeUrl,
    onResume,
    onConfirmationSelect,
  } = props;

  const onFieldValueChange = React.useCallback(
    (entry: CallbackEntry, value: InputValues[string]): void => {
      const key = callbackKey(entry.callback.type, entry.typeIndex);
      setInputValues((previous) => {
        if (previous[key] === value) {
          return previous;
        }
        return {
          ...previous,
          [key]: value,
        };
      });
    },
    [setInputValues]
  );

  return (
    <>
      {callbackEntries.map((entry) => (
        <JourneyCallbackEntryItem
          key={`${entry.callback.type}-${entry.absoluteIndex}`}
          entry={entry}
          fieldValue={inputValues[callbackKey(entry.callback.type, entry.typeIndex)]}
          loading={loading}
          autoSubmitting={autoSubmitting}
          resumeUrl={resumeUrl}
          setResumeUrl={setResumeUrl}
          onResume={onResume}
          onConfirmationSelect={onConfirmationSelect}
          onFieldValueChange={onFieldValueChange}
        />
      ))}
    </>
  );
}

type JourneyCallbackEntryItemProps = CallbackFormContext & {
  entry: CallbackEntry;
  fieldValue: InputValues[string] | undefined;
  onFieldValueChange: (
    entry: CallbackEntry,
    value: InputValues[string]
  ) => void;
};

function JourneyCallbackEntryItemComponent(
  props: JourneyCallbackEntryItemProps
): React.ReactElement {
  const {
    entry,
    fieldValue,
    loading,
    autoSubmitting,
    resumeUrl,
    setResumeUrl,
    onResume,
    onConfirmationSelect,
    onFieldValueChange,
  } = props;

  const setFieldValue = React.useCallback(
    (value: InputValues[string]): void => {
      onFieldValueChange(entry, value);
    },
    [entry, onFieldValueChange]
  );

  const context = React.useMemo<CallbackRenderContext>(
    () => ({
      fieldValue,
      setFieldValue,
      loading,
      autoSubmitting,
      resumeUrl,
      setResumeUrl,
      onResume,
      onConfirmationSelect,
    }),
    [
      fieldValue,
      setFieldValue,
      loading,
      autoSubmitting,
      resumeUrl,
      setResumeUrl,
      onResume,
      onConfirmationSelect,
    ]
  );

  return renderCallbackEntry(entry, context);
}

const JourneyCallbackEntryItem = React.memo(
  JourneyCallbackEntryItemComponent,
  (previous, next) =>
    previous.entry === next.entry &&
    previous.fieldValue === next.fieldValue &&
    previous.loading === next.loading &&
    previous.autoSubmitting === next.autoSubmitting &&
    previous.resumeUrl === next.resumeUrl
);

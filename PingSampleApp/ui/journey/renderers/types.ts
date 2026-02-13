/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import type { CallbackEntry, InputValues } from '../callbacks';

type InputValue = InputValues[string] | undefined;
type WritableInputValue = InputValues[string];

/**
 * Shared form context passed to callback entry renderers.
 */
export type CallbackFormContext = {
  loading: boolean;
  autoSubmitting: boolean;
  resumeUrl: string;
  setResumeUrl: React.Dispatch<React.SetStateAction<string>>;
  onResume: () => Promise<void>;
  onConfirmationSelect: (
    callbackType: string,
    typeIndex: number,
    optionIndex: number
  ) => Promise<void>;
};

/**
 * Shared renderer context used by journey callback renderers.
 */
export type CallbackRenderContext = CallbackFormContext & {
  fieldValue: InputValue;
  setFieldValue: (value: WritableInputValue) => void;
};

/**
 * Function signature for callback leaf renderers.
 */
export type CallbackRenderer = (
  entry: CallbackEntry,
  context: CallbackRenderContext
) => React.ReactElement;

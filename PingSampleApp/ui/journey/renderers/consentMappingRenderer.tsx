/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import type { CallbackEntry } from '../utils/callbacks';
import { readBoolean, readString } from '../utils/callbacks';
import type { CallbackRenderContext } from './types';
import { renderToggleCallback } from './toggleRendererBase';

/**
 * Renders `ConsentMappingCallback` with explicit consent copy.
 *
 * @param entry - Callback entry metadata.
 * @param context - Shared render context.
 * @returns Rendered consent toggle block.
 */
export function renderConsentMappingCallback(
  entry: CallbackEntry,
  context: CallbackRenderContext
): React.ReactElement {
  const { callback } = entry;
  return renderToggleCallback(entry, context, {
    label: readString(callback.message, readString(callback.prompt, 'Provide consent')),
    defaultValue: readBoolean(callback.value, false),
  });
}

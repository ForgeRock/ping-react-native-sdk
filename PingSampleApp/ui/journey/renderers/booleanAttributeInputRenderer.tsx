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
 * Renders `BooleanAttributeInputCallback` as a boolean toggle.
 *
 * @param entry - Callback entry metadata.
 * @param context - Shared render context.
 * @returns Rendered boolean attribute toggle block.
 */
export function renderBooleanAttributeInputCallback(
  entry: CallbackEntry,
  context: CallbackRenderContext
): React.ReactElement {
  const { callback } = entry;
  return renderToggleCallback(entry, context, {
    label: readString(callback.prompt, callback.type),
    defaultValue: readBoolean(callback.value, false),
  });
}

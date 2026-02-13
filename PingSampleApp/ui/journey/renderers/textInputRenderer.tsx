/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import type { CallbackEntry } from '../utils/callbacks';
import type { CallbackRenderContext } from './types';
import { renderTextFieldCallback } from './textFieldRendererBase';

/**
 * Renders `TextInputCallback` as a generic text input field.
 *
 * @param entry - Callback entry metadata.
 * @param context - Shared render context.
 * @returns Rendered text input block.
 */
export function renderTextInputCallback(
  entry: CallbackEntry,
  context: CallbackRenderContext
): React.ReactElement {
  return renderTextFieldCallback(entry, context, {
    defaultLabel: 'Text',
  });
}

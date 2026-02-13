/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import type { CallbackEntry } from '../callbacks';
import type { CallbackRenderContext } from './types';
import { renderTextFieldCallback } from './textFieldRendererBase';

/**
 * Renders `ValidatedCreateUsernameCallback` as a username text field.
 *
 * @param entry - Callback entry metadata.
 * @param context - Shared render context.
 * @returns Rendered validated username input block.
 */
export function renderValidatedCreateUsernameCallback(
  entry: CallbackEntry,
  context: CallbackRenderContext
): React.ReactElement {
  return renderTextFieldCallback(entry, context, {
    defaultLabel: 'Create username',
  });
}

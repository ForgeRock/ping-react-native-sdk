/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import type { CallbackEntry } from '../callbacks';
import { isIntegrationRequiredCallback } from '../callbacks';
import { renderBooleanAttributeInputCallback } from './booleanAttributeInputRenderer';
import { renderChoiceCallback } from './choiceRenderer';
import { renderConfirmationCallback } from './confirmationRenderer';
import { renderConsentMappingCallback } from './consentMappingRenderer';
import { renderDefaultInputCallback } from './defaultInputRenderer';
import { renderDeviceProfileCallback } from './deviceProfileRenderer';
import { renderHiddenValueCallback } from './hiddenValueRenderer';
import { renderIntegrationRequiredCallback } from './integrationRequiredRenderer';
import { renderKbaCreateCallback } from './kbaCreateRenderer';
import { renderMetadataCallback } from './metadataRenderer';
import { renderNameCallback } from './nameRenderer';
import { renderNumberAttributeInputCallback } from './numberAttributeInputRenderer';
import { renderPasswordCallback } from './passwordRenderer';
import { renderPollingWaitCallback } from './pollingWaitRenderer';
import { renderStringAttributeInputCallback } from './stringAttributeInputRenderer';
import { renderSuspendedTextOutputCallback } from './suspendedTextOutputRenderer';
import { renderTermsAndConditionsCallback } from './termsAndConditionsRenderer';
import { renderTextInputCallback } from './textInputRenderer';
import { renderTextOutputCallback } from './textOutputRenderer';
import { renderValidatedCreatePasswordCallback } from './validatedCreatePasswordRenderer';
import { renderValidatedCreateUsernameCallback } from './validatedCreateUsernameRenderer';
import type { CallbackRenderContext, CallbackRenderer } from './types';

const callbackRenderers: Record<string, CallbackRenderer> = {
  NameCallback: renderNameCallback,
  PasswordCallback: renderPasswordCallback,
  TextInputCallback: renderTextInputCallback,
  StringAttributeInputCallback: renderStringAttributeInputCallback,
  NumberAttributeInputCallback: renderNumberAttributeInputCallback,
  ValidatedCreateUsernameCallback: renderValidatedCreateUsernameCallback,
  ValidatedCreatePasswordCallback: renderValidatedCreatePasswordCallback,
  HiddenValueCallback: renderHiddenValueCallback,
  BooleanAttributeInputCallback: renderBooleanAttributeInputCallback,
  ConsentMappingCallback: renderConsentMappingCallback,
  TermsAndConditionsCallback: renderTermsAndConditionsCallback,
  DeviceProfileCallback: renderDeviceProfileCallback,
  PollingWaitCallback: renderPollingWaitCallback,
  SuspendedTextOutputCallback: renderSuspendedTextOutputCallback,
  TextOutputCallback: renderTextOutputCallback,
  MetadataCallback: renderMetadataCallback,
  ConfirmationCallback: renderConfirmationCallback,
  ChoiceCallback: renderChoiceCallback,
  KbaCreateCallback: renderKbaCreateCallback,
};

/**
 * Resolves and renders a callback entry via the renderer registry.
 *
 * @param entry - Callback entry metadata.
 * @param context - Shared render context.
 * @returns Rendered callback element.
 */
export function renderCallbackEntry(
  entry: CallbackEntry,
  context: CallbackRenderContext
): React.ReactElement {
  if (
    entry.callback.type !== 'DeviceProfileCallback' &&
    isIntegrationRequiredCallback(entry.callback.type)
  ) {
    return renderIntegrationRequiredCallback(entry);
  }

  const renderer = callbackRenderers[entry.callback.type];
  if (renderer) {
    return renderer(entry, context);
  }
  return renderDefaultInputCallback(entry, context);
}

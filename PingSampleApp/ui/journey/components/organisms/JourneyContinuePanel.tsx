/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useCallback, useMemo } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import type {
  JourneyCallbackType,
  JourneyFormResult,
} from '@ping-identity/rn-journey';
import { commonStyles } from '../../../../src/styles/common';
import { journeyClientPanelStyles as styles } from '../../../../src/styles/journeyStyles';
import JourneyFieldRenderer from '../molecules/renderers/JourneyFieldRenderer';
import { DEFAULT_AUTO_POLLING_WAIT_MS } from '../../utils/clientPanel';
import PingTextInput from '../../../components/atoms/PingTextInput';

/**
 * Props for rendering the active `ContinueNode` callback area.
 */
export type JourneyContinuePanelProps = {
  form: JourneyFormResult;
  loading: boolean;
  pollingWaitMs: number | null;
  resumeUrl: string;
  onResumeUrlChange: (value: string) => void;
  onResume: () => Promise<void>;
  onSubmit: () => Promise<void>;
};

/**
 * Renders callback fields and continuation actions for a `ContinueNode`.
 *
 * @param props - Component props.
 * @returns Continue node panel markup.
 */
export default function JourneyContinuePanel(
  props: JourneyContinuePanelProps,
): React.ReactElement {
  const {
    form,
    loading,
    pollingWaitMs,
    resumeUrl,
    onResumeUrlChange,
    onResume,
    onSubmit,
  } = props;
  const { fields, values, meta, setValue } = form;

  const callbackTypes = useMemo<Set<JourneyCallbackType>>(
    () => new Set(fields.map(field => field.ref.type)),
    [fields],
  );
  // These flags drive integration UX:
  // - DeviceProfile/Suspended/Polling callbacks are handled by panel-level effects.
  // - "manual submit" means at least one callback requires user-provided values.
  const hasDeviceProfileCallback = callbackTypes.has('DeviceProfileCallback');
  const hasSuspendedCallback = callbackTypes.has('SuspendedTextOutputCallback');
  const hasPollingWaitCallback = callbackTypes.has('PollingWaitCallback');
  const hasManualSubmit = meta.hasManual;
  // Integration-required callbacks are currently not auto-wired in this sample
  // (for example FIDO/Protect/IdP/ReCaptcha/Binding), so we block auto-advance.
  const hasBlockingIntegration = fields.some(
    field =>
      field.capability === 'integration_required' &&
      field.ref.type !== 'DeviceProfileCallback',
  );
  const hasUnsupportedCallbacks = meta.hasUnsupported;
  const hasUnacceptedRequiredAgreements = meta.hasRequiredConsentMissing;
  const canAutoAdvanceWithContinueButton =
    !hasManualSubmit &&
    !hasBlockingIntegration &&
    !hasUnsupportedCallbacks &&
    !hasDeviceProfileCallback &&
    !hasSuspendedCallback &&
    !hasPollingWaitCallback;
  const shouldShowContinueButton =
    hasManualSubmit || canAutoAdvanceWithContinueButton;
  const submitDisabled =
    loading ||
    hasUnacceptedRequiredAgreements ||
    hasBlockingIntegration ||
    hasUnsupportedCallbacks;
  const pollingWaitSeconds = Math.max(
    1,
    Math.ceil((pollingWaitMs ?? DEFAULT_AUTO_POLLING_WAIT_MS) / 1000),
  );

  const handleResumePress = useCallback(async (): Promise<void> => {
    await onResume();
  }, [onResume]);

  const handleSubmitPress = useCallback(async (): Promise<void> => {
    await onSubmit();
  }, [onSubmit]);

  return (
    <>
      {/* `setFieldValue` writes into `useJourneyForm` state, consumed as `form.input` on submit. */}
      {fields.map(field => (
        <JourneyFieldRenderer
          key={field.id}
          field={field}
          currentValue={values[field.id]}
          setFieldValue={setValue}
        />
      ))}

      {hasBlockingIntegration ? (
        <Text style={styles.blockingNote}>
          This node includes callbacks that require extra native integrations
          (FIDO, Protect, IdP, ReCaptcha, or Binding). Configure those modules
          to continue this journey.
        </Text>
      ) : null}

      {hasUnsupportedCallbacks ? (
        <Text style={styles.blockingNote}>
          This node includes callback types not handled by the helper submit
          planner. Add custom handling for these callbacks to continue.
        </Text>
      ) : null}

      {!hasManualSubmit && hasDeviceProfileCallback ? (
        <Text style={styles.autoPollingNote}>
          Device profile callback detected. Collecting automatically.
        </Text>
      ) : null}

      {hasSuspendedCallback ? (
        <>
          <PingTextInput
            containerStyle={styles.topGap}
            label="Resume URL"
            value={resumeUrl}
            onChangeText={onResumeUrlChange}
            placeholder="myapp://oauth2redirect?..."
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[
              commonStyles.buttonSecondary,
              loading ? styles.disabledButton : null,
            ]}
            onPress={handleResumePress}
            disabled={loading}
          >
            <Text style={commonStyles.buttonTextSecondary}>Resume</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {shouldShowContinueButton ? (
        <TouchableOpacity
          style={[
            commonStyles.buttonPrimary,
            submitDisabled && styles.disabledButton,
          ]}
          onPress={handleSubmitPress}
          disabled={submitDisabled}
        >
          <Text style={commonStyles.buttonText}>Continue</Text>
        </TouchableOpacity>
      ) : null}

      {!hasManualSubmit && hasPollingWaitCallback ? (
        <Text style={styles.autoPollingNote}>
          Polling callback detected. Continuing automatically in{' '}
          {pollingWaitSeconds}s.
        </Text>
      ) : null}
    </>
  );
}

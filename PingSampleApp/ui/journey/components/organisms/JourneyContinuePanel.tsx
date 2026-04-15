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
  /**
   * Headless form contract resolved for the active ContinueNode.
   */
  form: JourneyFormResult;
  /**
   * True while a Journey action is currently in-flight.
   */
  loading: boolean;
  /**
   * Polling wait time resolved from PollingWaitCallback payload, in milliseconds.
   */
  pollingWaitMs: number | null;
  /**
   * Current resume URI field value shown when suspended callbacks are active.
   */
  resumeUrl: string;
  /**
   * Resume URI input updater.
   *
   * @param value - Next resume URI value.
   * @returns Void.
   */
  onResumeUrlChange: (value: string) => void;
  /**
   * Executes resume action with current `resumeUrl`.
   *
   * @returns Promise resolved after resume attempt completes.
   */
  onResume: () => Promise<void>;
  /**
   * Executes submit action for current callback form input.
   *
   * @returns Promise resolved after submit attempt completes.
   */
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
  const isAutoHandledIntegrationCallback = useCallback(
    (type: JourneyCallbackType): boolean =>
      type === 'DeviceProfileCallback' ||
      type === 'FidoRegistrationCallback' ||
      type === 'FidoAuthenticationCallback',
    [],
  );
  const hasSuspendedCallback = callbackTypes.has('SuspendedTextOutputCallback');
  const hasPollingWaitCallback = callbackTypes.has('PollingWaitCallback');
  const hasManualSubmit = fields.some(field => field.requiresUserInput);

  const hasBlockingIntegration = fields.some(
    field =>
      (field.executionMode === 'integration_required' &&
        !isAutoHandledIntegrationCallback(field.ref.type)) ||
      (field.executionMode === 'auto_capable' &&
        !isAutoHandledIntegrationCallback(field.ref.type)),
  );
  const blockingIntegrationCallbackTypes = useMemo<string[]>(
    () =>
      Array.from(
        new Set(
          fields
            .filter(
              field =>
                (field.executionMode === 'integration_required' &&
                  !isAutoHandledIntegrationCallback(field.ref.type)) ||
                (field.executionMode === 'auto_capable' &&
                  !isAutoHandledIntegrationCallback(field.ref.type)),
            )
            .map(field => field.ref.type),
        ),
      ),
    [fields, isAutoHandledIntegrationCallback],
  );
  const hasUnsupportedCallbacks = meta.hasUnsupported;
  const unsupportedCallbackTypes = useMemo<string[]>(
    () =>
      Array.from(
        new Set(
          fields
            .filter(field => field.executionMode === 'unsupported')
            .map(field => field.ref.type),
        ),
      ),
    [fields],
  );
  const unsupportedIssueCallbackTypes = useMemo<JourneyCallbackType[]>(
    () =>
      Array.from(
        new Set(
          form.issues
            .filter(issue => issue.code === 'UNSUPPORTED_CALLBACK')
            .map(issue => issue.callbackType)
            .filter(
              (value): value is JourneyCallbackType =>
                typeof value === 'string' && value.length > 0,
            ),
        ),
      ),
    [form.issues],
  );
  const integrationIssueCallbackTypes = useMemo<JourneyCallbackType[]>(
    () =>
      Array.from(
        new Set(
          form.issues
            .filter(
              issue =>
                issue.code === 'INTEGRATION_REQUIRED' &&
                !!issue.callbackType &&
                !isAutoHandledIntegrationCallback(issue.callbackType),
            )
            .map(issue => issue.callbackType)
            .filter(
              (value): value is JourneyCallbackType =>
                typeof value === 'string' && value.length > 0,
            ),
        ),
      ),
    [form.issues, isAutoHandledIntegrationCallback],
  );
  const blockingIssueMessages = useMemo<string[]>(
    () =>
      form.issues
        .filter(
          issue =>
            issue.code === 'UNSUPPORTED_CALLBACK' ||
            (issue.code === 'INTEGRATION_REQUIRED' &&
              !!issue.callbackType &&
              !isAutoHandledIntegrationCallback(issue.callbackType)),
        )
        .map(issue => issue.message),
    [form.issues, isAutoHandledIntegrationCallback],
  );
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
        <>
          <Text style={styles.blockingNote}>
            This node includes callbacks that require extra native integrations
            (Protect, IdP, ReCaptcha, or Binding). Configure those modules to
            continue this journey.
          </Text>
          <Text style={styles.blockingNote}>
            Integration-required callbacks:{' '}
            {[
              ...new Set([
                ...blockingIntegrationCallbackTypes,
                ...integrationIssueCallbackTypes,
              ]),
            ].join(', ') || 'Unknown'}
          </Text>
        </>
      ) : null}

      {blockingIssueMessages.length > 0 ? (
        <Text style={styles.blockingNote}>
          Blocking reasons: {blockingIssueMessages.join(' | ')}
        </Text>
      ) : null}

      {hasUnsupportedCallbacks ? (
        <>
          <Text style={styles.blockingNote}>
            This node includes callback types not handled by the helper submit
            planner. Add custom handling for these callbacks to continue.
          </Text>
          <Text style={styles.blockingNote}>
            Unsupported callbacks:{' '}
            {[
              ...new Set([
                ...unsupportedCallbackTypes,
                ...unsupportedIssueCallbackTypes,
              ]),
            ].join(', ') || 'Unknown'}
          </Text>
        </>
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
            onPress={onResume}
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
          onPress={onSubmit}
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

/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native';
import { collectDeviceProfileForJourney } from '@ping-identity/rn-device-profile';
import {
  useJourney,
  useJourneyForm,
  type JourneyClient,
  type JourneyStartOptions,
} from '@ping-identity/rn-journey';
import { commonStyles } from '../../../../src/styles/common';
import { journeyClientPanelStyles as styles } from '../../../../src/styles/journeyStyles';
import JourneyContinuePanel from './JourneyContinuePanel';
import {
  DEVICE_PROFILE_COLLECTORS,
  resolvePollingWaitMs,
} from '../../utils/clientPanel';

/**
 * Props for a self-contained Journey panel bound to a single Journey client.
 */
export type JourneyClientPanelProps = {
  /**
   * Journey client used for native instance resolution and device profile collection.
   */
  journeyClient: JourneyClient;
  title?: string;
  startOptions?: JourneyStartOptions;
  initialJourneyName?: string;
  autoStartOnMount?: boolean;
  /**
   * Optional callback invoked once when an authenticated Journey session is detected.
   */
  onAuthenticated?: () => void;
  /**
   * When true, waits for explicit user action on the success screen before invoking `onAuthenticated`.
   */
  requireSuccessConfirmation?: boolean;
};

/**
 * Renders a complete helper-driven Journey experience for one client instance.
 *
 * @param props - Panel props.
 * @returns Journey panel element.
 */
export default function JourneyClientPanel(
  props: JourneyClientPanelProps,
): React.ReactElement {
  const {
    journeyClient,
    startOptions,
    initialJourneyName,
    autoStartOnMount = false,
    onAuthenticated,
    requireSuccessConfirmation = false,
  } = props;
  const [node, { start, next, resume, user, logoutUser, loading, error }] =
    useJourney(journeyClient);
  const form = useJourneyForm(node);

  const [journeyName, setJourneyName] = useState<string>(
    initialJourneyName?.trim() ?? '',
  );
  const [resumeUrl, setResumeUrl] = useState<string>('');
  const [hasActiveSession, setHasActiveSession] = useState<boolean>(false);
  const [isSessionCheckRunning, setIsSessionCheckRunning] =
    useState<boolean>(true);

  const hasAutoStartedRef = useRef<boolean>(false);
  const lastAutoResumedUrlRef = useRef<string | null>(null);
  const hasNotifiedAuthenticatedRef = useRef<boolean>(false);
  const lastAutoDeviceProfileRequestKeyRef = useRef<string | null>(null);

  const fields = form.fields;
  const deviceProfileFields = form.getFieldsByType('DeviceProfileCallback');
  const hasDeviceProfileCallback = deviceProfileFields.length > 0;
  const hasPollingWaitCallback =
    form.getFieldsByType('PollingWaitCallback').length > 0;
  const hasSuspendedCallback =
    form.getFieldsByType('SuspendedTextOutputCallback').length > 0;
  const pollingWaitMs = useMemo<number | null>(
    () => resolvePollingWaitMs(fields),
    [fields],
  );
  const deviceProfileRequestKey = useMemo<string>(() => {
    return deviceProfileFields
      .map(field => `${field.ref.type}:${field.ref.typeIndex}`)
      .join('|');
  }, [deviceProfileFields]);

  useEffect(() => {
    // Keep local editable state in sync when parent swaps configs.
    if (!initialJourneyName) {
      return;
    }
    setJourneyName(initialJourneyName.trim());
    hasAutoStartedRef.current = false;
  }, [initialJourneyName]);

  useEffect(() => {
    // Device profile integration behavior:
    // 1. Run once per DeviceProfileCallback instance (keyed by type/typeIndex).
    // 2. Collect using the shared default collector set.
    // 3. If the node has no manual callbacks and no polling wait, auto-submit `next({})`
    //    so the journey can continue without extra user interaction.
    if (node?.type !== 'ContinueNode' || !hasDeviceProfileCallback || loading) {
      if (node?.type !== 'ContinueNode') {
        lastAutoDeviceProfileRequestKeyRef.current = null;
      }
      return;
    }

    if (!deviceProfileRequestKey) {
      return;
    }

    if (
      lastAutoDeviceProfileRequestKeyRef.current === deviceProfileRequestKey
    ) {
      return;
    }

    lastAutoDeviceProfileRequestKeyRef.current = deviceProfileRequestKey;

    const runAutoDeviceProfile = async (): Promise<void> => {
      try {
        await collectDeviceProfileForJourney(journeyClient, [
          ...DEVICE_PROFILE_COLLECTORS,
        ]);

        if (!form.meta.hasManual && !hasPollingWaitCallback) {
          await next({});
        }
      } catch (cause) {
        Alert.alert('Device profile failed', String(cause));
      }
    };

    void runAutoDeviceProfile();
  }, [
    deviceProfileRequestKey,
    form.meta.hasManual,
    hasDeviceProfileCallback,
    hasPollingWaitCallback,
    journeyClient,
    loading,
    next,
    node?.type,
  ]);

  const refreshSession = useCallback(
    async (showError = true): Promise<void> => {
      try {
        const session = await user();
        setHasActiveSession(Boolean(session));
      } catch (cause) {
        setHasActiveSession(false);
        if (showError) {
          Alert.alert('Session refresh failed', String(cause));
        }
      }
    },
    [user],
  );

  useEffect(() => {
    // Bootstrap current session state on mount/client change.
    // This lets the panel show success actions immediately when a session
    // already exists from a prior app launch or restored native state.
    let cancelled = false;

    const loadSession = async (): Promise<void> => {
      setIsSessionCheckRunning(true);
      try {
        await refreshSession(false);
      } finally {
        if (!cancelled) {
          setIsSessionCheckRunning(false);
        }
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  useEffect(() => {
    // `SuccessNode` implies active authentication. Keep UI session flag aligned.
    if (node?.type === 'SuccessNode') {
      setHasActiveSession(true);
    }
  }, [node?.type]);

  useEffect(() => {
    // Notify parent exactly once per authenticated state transition.
    // This drives screen-level navigation/flow handoff from the panel.
    if (!onAuthenticated) {
      return;
    }
    if (requireSuccessConfirmation) {
      hasNotifiedAuthenticatedRef.current = false;
      return;
    }

    const isAuthenticated = node?.type === 'SuccessNode' || hasActiveSession;
    if (!isAuthenticated) {
      hasNotifiedAuthenticatedRef.current = false;
      return;
    }

    if (hasNotifiedAuthenticatedRef.current) {
      return;
    }

    hasNotifiedAuthenticatedRef.current = true;
    onAuthenticated();
  }, [
    hasActiveSession,
    node?.type,
    onAuthenticated,
    requireSuccessConfirmation,
  ]);

  const onContinueAfterSuccess = useCallback((): void => {
    // Explicit continuation path for UX that requires user confirmation
    // on the success screen before navigating away.
    if (!onAuthenticated) {
      return;
    }
    hasNotifiedAuthenticatedRef.current = true;
    onAuthenticated();
  }, [onAuthenticated]);

  const onStart = useCallback(async (): Promise<boolean> => {
    const trimmedJourneyName = journeyName.trim();
    if (!trimmedJourneyName) {
      Alert.alert('Enter a journey name first');
      return false;
    }

    try {
      await start(trimmedJourneyName, startOptions);
      // Clear prior form/resume state when starting a new flow.
      form.reset();
      setResumeUrl('');
      return true;
    } catch (cause) {
      Alert.alert('Failed to start journey', String(cause));
      return false;
    }
  }, [form, journeyName, start, startOptions]);

  useEffect(() => {
    // Optional hands-free start mode for sample/demo usage.
    // Guarded to ensure only one auto-start attempt per eligible state.
    if (!autoStartOnMount) {
      return;
    }
    if (hasAutoStartedRef.current) {
      return;
    }
    if (loading || isSessionCheckRunning || hasActiveSession || node) {
      return;
    }
    if (!journeyName.trim()) {
      return;
    }

    hasAutoStartedRef.current = true;
    const runAutoStart = async (): Promise<void> => {
      const didStart = await onStart();
      if (!didStart) {
        hasAutoStartedRef.current = false;
      }
    };

    void runAutoStart();
  }, [
    autoStartOnMount,
    hasActiveSession,
    isSessionCheckRunning,
    journeyName,
    loading,
    node,
    onStart,
  ]);

  const onResume = useCallback(async (): Promise<void> => {
    const trimmedResumeUrl = resumeUrl.trim();
    if (!trimmedResumeUrl) {
      Alert.alert('Paste the resume URL first.');
      return;
    }

    try {
      await resume(trimmedResumeUrl);
      setResumeUrl('');
    } catch (cause) {
      Alert.alert('Resume failed', String(cause));
    }
  }, [resume, resumeUrl]);

  useEffect(() => {
    // Deep-link resume listener for callbacks that suspend browser/auth flow.
    // Duplicate URL guard prevents repeated resume calls on repeated events.
    if (!hasSuspendedCallback) {
      return;
    }

    const subscription = Linking.addEventListener('url', ({ url }) => {
      const trimmedResumeUrl = url.trim();
      if (
        !trimmedResumeUrl ||
        lastAutoResumedUrlRef.current === trimmedResumeUrl
      ) {
        return;
      }

      lastAutoResumedUrlRef.current = trimmedResumeUrl;

      const runAutoResume = async (): Promise<void> => {
        try {
          setResumeUrl(trimmedResumeUrl);
          await resume(trimmedResumeUrl);
          setResumeUrl('');
        } catch (cause) {
          Alert.alert('Resume failed', String(cause));
        }
      };

      void runAutoResume();
    });

    return () => {
      subscription.remove();
    };
  }, [hasSuspendedCallback, resume]);

  const onLogout = useCallback(async (): Promise<void> => {
    try {
      await logoutUser();
      // Reset panel lifecycle flags so a fresh journey can be started cleanly.
      form.reset();
      setResumeUrl('');
      setHasActiveSession(false);
      hasAutoStartedRef.current = false;
      hasNotifiedAuthenticatedRef.current = false;
    } catch (cause) {
      Alert.alert('Logout failed', String(cause));
    }
  }, [form, logoutUser]);

  const onSubmit = useCallback(async (): Promise<void> => {
    if (loading) {
      return;
    }

    if (!form.canSubmit) {
      // Show friendlier guidance for the most common validation failure.
      const firstIssue = form.issues[0];
      if (firstIssue?.code === 'REQUIRED_CONSENT_MISSING') {
        Alert.alert('Accept required terms/consent to continue');
        return;
      }

      Alert.alert(
        'Cannot continue',
        firstIssue?.message ?? 'Resolve callback issues before submitting.',
      );
      return;
    }

    try {
      // Includes DeviceProfileCallback values populated by `useJourneyForm`.
      await next(form.input);
    } catch (cause) {
      Alert.alert('Submit failed', String(cause));
    }
  }, [form.canSubmit, form.input, form.issues, loading, next]);

  const showCallbackScreen = node?.type === 'ContinueNode';
  const showSuccessScreen = node?.type === 'SuccessNode' || hasActiveSession;

  return (
    <View style={styles.container}>
      <View style={commonStyles.card}>
        {showCallbackScreen ? (
          <JourneyContinuePanel
            form={form}
            loading={loading}
            pollingWaitMs={pollingWaitMs}
            resumeUrl={resumeUrl}
            onResumeUrlChange={setResumeUrl}
            onResume={onResume}
            onSubmit={onSubmit}
          />
        ) : null}

        {showSuccessScreen ? (
          <View style={styles.successActionsContainer}>
            <TouchableOpacity
              style={commonStyles.buttonPrimary}
              onPress={onLogout}
            >
              <Text style={commonStyles.buttonText}>Logout</Text>
            </TouchableOpacity>
            {requireSuccessConfirmation && onAuthenticated ? (
              <TouchableOpacity
                style={commonStyles.buttonSecondary}
                onPress={onContinueAfterSuccess}
              >
                <Text style={commonStyles.buttonTextSecondary}>Continue</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {node?.type === 'ErrorNode' ? (
          <Text style={commonStyles.textError}>
            {typeof node.message === 'string'
              ? node.message
              : 'A server-side validation error occurred.'}
          </Text>
        ) : null}

        {node?.type === 'FailureNode' ? (
          <Text style={commonStyles.textError}>
            {typeof node.cause === 'string'
              ? node.cause
              : typeof node.message === 'string'
              ? node.message
              : 'An unexpected failure occurred.'}
          </Text>
        ) : null}

        {error ? (
          <Text style={commonStyles.textError}>
            {typeof error.message === 'string' ? error.message : String(error)}
          </Text>
        ) : null}

        {!showCallbackScreen &&
        !showSuccessScreen &&
        !loading &&
        !isSessionCheckRunning ? (
          <Text style={styles.autoPollingNote}>
            No active Journey flow. Start from Journey Configuration.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

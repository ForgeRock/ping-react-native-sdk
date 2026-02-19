/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native';
import { collectDeviceProfileForJourney } from '@ping-identity/rn-device-profile';
import {
  useJourney,
  useJourneyForm,
  type JourneyCallbackType,
  type JourneyClient,
  type JourneyStartOptions,
} from '@ping-identity/rn-journey';
import { commonStyles } from '../../../src/styles/common';
import JourneyContinuePanel from './JourneyContinuePanel';
import { styles } from './journeyClientPanelStyles';
import {
  DEFAULT_AUTO_POLLING_WAIT_MS,
  DEVICE_PROFILE_COLLECTORS,
  resolvePollingWaitMs,
} from '../utils/clientPanel';

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
};

/**
 * Renders a complete helper-driven Journey experience for one client instance.
 *
 * @param props - Panel props.
 * @returns Journey panel element.
 */
export default function JourneyClientPanel(
  props: JourneyClientPanelProps
): React.ReactElement {
  const {
    journeyClient,
    startOptions,
    initialJourneyName,
    autoStartOnMount = false,
    onAuthenticated,
  } = props;
  const [node, { start, next, resume, user, logoutUser, loading, error }] = useJourney(journeyClient);
  const form = useJourneyForm(node);

  const [journeyName, setJourneyName] = useState<string>(initialJourneyName?.trim() ?? '');
  const [resumeUrl, setResumeUrl] = useState<string>('');
  const [hasActiveSession, setHasActiveSession] = useState<boolean>(false);
  const [isSessionCheckRunning, setIsSessionCheckRunning] = useState<boolean>(true);

  const isMountedRef = useRef<boolean>(true);
  const hasAutoStartedRef = useRef<boolean>(false);
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoResumedUrlRef = useRef<string | null>(null);
  const hasNotifiedAuthenticatedRef = useRef<boolean>(false);
  const lastAutoDeviceProfileRequestKeyRef = useRef<string | null>(null);

  const fields = form.fields;
  const callbackTypes = useMemo<Set<JourneyCallbackType>>(
    () => new Set(fields.map((field) => field.ref.type)),
    [fields]
  );
  const hasDeviceProfileCallback = callbackTypes.has('DeviceProfileCallback');
  const hasPollingWaitCallback = callbackTypes.has('PollingWaitCallback');
  const hasSuspendedCallback = callbackTypes.has('SuspendedTextOutputCallback');
  const hasBlockingIntegrationCallback = fields.some(
    (field) =>
      field.capability === 'integration_required' &&
      field.ref.type !== 'DeviceProfileCallback'
  );
  const pollingWaitMs = useMemo<number | null>(() => resolvePollingWaitMs(fields), [fields]);
  const deviceProfileRequestKey = useMemo<string>(() => {
    return fields
      .filter((field) => field.ref.type === 'DeviceProfileCallback')
      .map((field) => `${field.ref.type}:${field.ref.typeIndex}`)
      .join('|');
  }, [fields]);
  const shouldAutoPoll =
    hasPollingWaitCallback &&
    !form.meta.hasManual &&
    !hasBlockingIntegrationCallback &&
    !form.meta.hasUnsupported;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!initialJourneyName) {
      return;
    }
    setJourneyName(initialJourneyName.trim());
    hasAutoStartedRef.current = false;
  }, [initialJourneyName]);

  useEffect(() => {
    if (node?.type !== 'ContinueNode' || !shouldAutoPoll || loading) {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }

    if (pollingTimerRef.current) {
      return;
    }

    const waitMs = Math.max(500, pollingWaitMs ?? DEFAULT_AUTO_POLLING_WAIT_MS);

    pollingTimerRef.current = setTimeout(() => {
      pollingTimerRef.current = null;
      if (!isMountedRef.current) {
        return;
      }

      const runAutoPolling = async (): Promise<void> => {
        try {
          await next({});
        } catch (cause) {
          Alert.alert('Polling continue failed', String(cause));
        }
      };

      runAutoPolling().catch(() => undefined);
    }, waitMs);
  }, [loading, next, node?.type, pollingWaitMs, shouldAutoPoll]);

  useEffect(() => {
    if (node?.type !== 'ContinueNode' || !hasDeviceProfileCallback || loading) {
      if (node?.type !== 'ContinueNode') {
        lastAutoDeviceProfileRequestKeyRef.current = null;
      }
      return;
    }

    if (!deviceProfileRequestKey) {
      return;
    }

    if (lastAutoDeviceProfileRequestKeyRef.current === deviceProfileRequestKey) {
      return;
    }

    lastAutoDeviceProfileRequestKeyRef.current = deviceProfileRequestKey;

    const runAutoDeviceProfile = async (): Promise<void> => {
      try {
        const result = await collectDeviceProfileForJourney(journeyClient, [...DEVICE_PROFILE_COLLECTORS]);
        if (result.type === 'error') {
          Alert.alert('Device profile failed', result.message ?? result.code);
          return;
        }

        if (!form.meta.hasManual && !hasPollingWaitCallback) {
          await next({});
        }
      } catch (cause) {
        Alert.alert('Device profile failed', String(cause));
      }
    };

    runAutoDeviceProfile().catch(() => undefined);
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

  const refreshSession = useCallback(async (showError = true): Promise<void> => {
    try {
      const session = await user();
      setHasActiveSession(Boolean(session));
    } catch (cause) {
      setHasActiveSession(false);
      if (showError) {
        Alert.alert('Session refresh failed', String(cause));
      }
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async (): Promise<void> => {
      setIsSessionCheckRunning(true);
      await refreshSession(false);
      if (!cancelled) {
        setIsSessionCheckRunning(false);
      }
    };

    loadSession().catch(() => {
      if (!cancelled) {
        setIsSessionCheckRunning(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  useEffect(() => {
    if (node?.type === 'SuccessNode') {
      setHasActiveSession(true);
    }
  }, [node?.type]);

  useEffect(() => {
    if (!onAuthenticated) {
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
  }, [hasActiveSession, node?.type, onAuthenticated]);

  const onStart = useCallback(async (): Promise<void> => {
    const trimmedJourneyName = journeyName.trim();
    if (!trimmedJourneyName) {
      Alert.alert('Enter a journey name first');
      return;
    }

    try {
      await start(trimmedJourneyName, startOptions);
      form.reset();
      setResumeUrl('');
    } catch (cause) {
      Alert.alert('Failed to start journey', String(cause));
    }
  }, [form, journeyName, start, startOptions]);

  useEffect(() => {
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
    onStart().catch(() => {
      hasAutoStartedRef.current = false;
    });
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
    if (!hasSuspendedCallback) {
      return;
    }

    const subscription = Linking.addEventListener('url', ({ url }) => {
      const trimmedResumeUrl = url.trim();
      if (!trimmedResumeUrl || lastAutoResumedUrlRef.current === trimmedResumeUrl) {
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

      runAutoResume().catch(() => undefined);
    });

    return () => {
      subscription.remove();
    };
  }, [hasSuspendedCallback, resume]);

  const onLogout = useCallback(async (): Promise<void> => {
    try {
      await logoutUser();
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
      const firstIssue = form.issues[0];
      if (firstIssue?.code === 'REQUIRED_CONSENT_MISSING') {
        Alert.alert('Accept required terms/consent to continue');
        return;
      }

      Alert.alert(
        'Cannot continue',
        firstIssue?.message ?? 'Resolve callback issues before submitting.'
      );
      return;
    }

    try {
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
          <TouchableOpacity style={commonStyles.buttonPrimary} onPress={onLogout}>
            <Text style={commonStyles.buttonText}>Logout</Text>
          </TouchableOpacity>
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

        {!showCallbackScreen && !showSuccessScreen && !loading && !isSessionCheckRunning ? (
          <Text style={styles.autoPollingNote}>
            No active Journey flow. Start from Journey Configuration.
          </Text>
        ) : null}

      </View>
    </View>
  );
}

/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collectDeviceProfileForJourney } from '@ping-identity/rn-device-profile';
import {
  useJourney,
  useJourneyForm,
  type JourneyCallbackType,
  type JourneyClient,
  type JourneySubmitIssue,
  type JourneyStartOptions,
} from '@ping-identity/rn-journey';
import { commonStyles } from '../../../src/styles/common';
import JourneyContinuePanel from './JourneyContinuePanel';
import JourneyDebugPanel from './JourneyDebugPanel';
import JourneySessionCard from './JourneySessionCard';
import JourneyStartPanel from './JourneyStartPanel';
import JourneyStatusPanel from './JourneyStatusPanel';
import JourneySubmitIssuesCard from './JourneySubmitIssuesCard';
import { styles } from './journeyClientPanelStyles';
import {
  createJourneyDebugEntry,
  sanitizeDebugPayload,
  type JourneyDebugEntry,
} from '../utils/debug';
import {
  DEFAULT_AUTO_POLLING_WAIT_MS,
  DEVICE_PROFILE_COLLECTORS,
  RECENT_JOURNEYS_STORAGE_KEY,
  extractGivenName,
  resolvePollingWaitMs,
} from '../utils/clientPanel';

const debugEventLimit = 80;

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
  const { journeyClient, title, startOptions } = props;
  const [node, { start, next, resume, user, logoutUser, loading, error }] = useJourney(journeyClient);
  const form = useJourneyForm(node);

  const [debugEntries, setDebugEntries] = useState<JourneyDebugEntry[]>([]);
  const [journeyName, setJourneyName] = useState<string>('');
  const [suggestedJourneys, setSuggestedJourneys] = useState<string[]>([]);
  const [showJourneyInput, setShowJourneyInput] = useState<boolean>(true);
  const [resumeUrl, setResumeUrl] = useState<string>('');
  const [submitIssues, setSubmitIssues] = useState<JourneySubmitIssue[]>([]);
  const [givenName, setGivenName] = useState<string | undefined>();
  const [sessionPayload, setSessionPayload] = useState<string | null>(null);
  const [isSessionCheckRunning, setIsSessionCheckRunning] = useState<boolean>(true);

  const isMountedRef = useRef<boolean>(true);
  const lastNodeSignatureRef = useRef<string>('');
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoResumedUrlRef = useRef<string | null>(null);

  const fields = form.fields;
  const callbackTypes = useMemo<Set<JourneyCallbackType>>(
    () => new Set(fields.map((field) => field.ref.type)),
    [fields]
  );
  const hasDeviceProfileCallback = callbackTypes.has('DeviceProfileCallback');
  const hasPollingWaitCallback = callbackTypes.has('PollingWaitCallback');
  const hasSuspendedCallback = callbackTypes.has('SuspendedTextOutputCallback');
  const hasActiveSession = sessionPayload !== null;
  const pollingWaitMs = useMemo<number | null>(() => resolvePollingWaitMs(fields), [fields]);
  const shouldAutoPoll =
    hasPollingWaitCallback &&
    !form.meta.hasManual &&
    !form.meta.hasIntegrationRequired &&
    !form.meta.hasUnsupported;

  const addDebugEntry = useCallback((titleValue: string, payload?: unknown): void => {
    const entry = createJourneyDebugEntry(titleValue, sanitizeDebugPayload(payload));
    setDebugEntries((previous) => [entry, ...previous].slice(0, debugEventLimit));
  }, []);

  const clearDebug = useCallback((): void => {
    setDebugEntries([]);
  }, []);

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
    (async (): Promise<void> => {
      try {
        const stored = await AsyncStorage.getItem(RECENT_JOURNEYS_STORAGE_KEY);
        if (stored && isMountedRef.current) {
          setSuggestedJourneys(JSON.parse(stored) as string[]);
        }
      } catch {
        // Ignore suggestion load failures in sample.
      }
    })();
  }, []);

  useEffect(() => {
    if (!node) {
      return;
    }

    const signature = `${node.type}:${JSON.stringify(node.input ?? null)}`;
    if (lastNodeSignatureRef.current === signature) {
      return;
    }
    lastNodeSignatureRef.current = signature;

    if (node.type === 'ContinueNode') {
      addDebugEntry('Received ContinueNode', {
        callbackCount: fields.length,
        callbackTypes: fields.map((field) => ({
          type: field.ref.type,
          typeIndex: field.ref.typeIndex,
        })),
        normalizedFields: fields.map((field) => ({
          id: field.id,
          type: field.ref.type,
          kind: field.kind,
          capability: field.capability,
          required: field.required,
        })),
      });
      return;
    }

    addDebugEntry(`Received ${node.type}`, node);
  }, [addDebugEntry, fields, node]);

  useEffect(() => {
    setSubmitIssues([]);
  }, [node]);

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
    addDebugEntry('Auto polling scheduled', { waitTimeMs: waitMs });

    pollingTimerRef.current = setTimeout(() => {
      pollingTimerRef.current = null;
      if (!isMountedRef.current) {
        return;
      }

      const runAutoPolling = async (): Promise<void> => {
        try {
          addDebugEntry('next() payload (auto-polling)', { callbacks: [] });
          await next({});
        } catch (cause) {
          addDebugEntry('auto polling failed', { error: String(cause) });
          Alert.alert('Polling continue failed', String(cause));
        }
      };

      runAutoPolling().catch(() => undefined);
    }, waitMs);
  }, [addDebugEntry, loading, next, node?.input, node?.type, pollingWaitMs, shouldAutoPoll]);

  const saveSuggestion = useCallback(
    async (name: string): Promise<void> => {
      const updated = [name, ...suggestedJourneys.filter((item) => item !== name)];
      setSuggestedJourneys(updated);
      await AsyncStorage.setItem(RECENT_JOURNEYS_STORAGE_KEY, JSON.stringify(updated));
    },
    [suggestedJourneys]
  );

  const refreshSession = useCallback(async (showError = true): Promise<void> => {
    try {
      const session = await user();
      if (!session) {
        setSessionPayload(null);
        setGivenName(undefined);
        return;
      }

      setSessionPayload(JSON.stringify(session, null, 2));
      setGivenName(extractGivenName(session));
      setShowJourneyInput(false);
    } catch (cause) {
      if (showError) {
        Alert.alert('Session refresh failed', String(cause));
      }
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async (): Promise<void> => {
      setIsSessionCheckRunning(true);
      addDebugEntry('user() session check requested');
      await refreshSession(false);
      if (!cancelled) {
        setIsSessionCheckRunning(false);
      }
      addDebugEntry('user() session check completed');
    };

    loadSession().catch(() => {
      if (!cancelled) {
        setIsSessionCheckRunning(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [addDebugEntry, refreshSession]);

  useEffect(() => {
    if (node?.type === 'SuccessNode') {
      refreshSession(false).catch(() => undefined);
    }
  }, [node?.type, refreshSession]);

  const onStart = useCallback(async (): Promise<void> => {
    const trimmedJourneyName = journeyName.trim();
    if (!trimmedJourneyName) {
      Alert.alert('Enter a journey name first');
      return;
    }

    try {
      addDebugEntry('start() requested', { journeyName: trimmedJourneyName });
      await saveSuggestion(trimmedJourneyName);
      await start(trimmedJourneyName, startOptions);
      setShowJourneyInput(false);
      form.reset();
      setResumeUrl('');
      setSessionPayload(null);
      setGivenName(undefined);
      addDebugEntry('start() completed');
    } catch (cause) {
      addDebugEntry('start() failed', { error: String(cause) });
      Alert.alert('Failed to start journey', String(cause));
    }
  }, [addDebugEntry, form, journeyName, saveSuggestion, start, startOptions]);

  const onResume = useCallback(async (): Promise<void> => {
    const trimmedResumeUrl = resumeUrl.trim();
    if (!trimmedResumeUrl) {
      Alert.alert('Paste the resume URL first.');
      return;
    }

    try {
      addDebugEntry('resume() requested', { resumeUrl: trimmedResumeUrl });
      await resume(trimmedResumeUrl);
      setResumeUrl('');
      addDebugEntry('resume() completed');
    } catch (cause) {
      addDebugEntry('resume() failed', { error: String(cause) });
      Alert.alert('Resume failed', String(cause));
    }
  }, [addDebugEntry, resume, resumeUrl]);

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
          addDebugEntry('resume() requested (deep-link)', {
            resumeUrl: trimmedResumeUrl,
          });
          await resume(trimmedResumeUrl);
          setResumeUrl('');
          addDebugEntry('resume() completed (deep-link)');
        } catch (cause) {
          addDebugEntry('resume() failed (deep-link)', { error: String(cause) });
          Alert.alert('Resume failed', String(cause));
        }
      };

      runAutoResume().catch(() => undefined);
    });

    return () => {
      subscription.remove();
    };
  }, [addDebugEntry, hasSuspendedCallback, resume]);

  const onLogout = useCallback(async (): Promise<void> => {
    try {
      addDebugEntry('logoutUser() requested');
      await logoutUser();
      setShowJourneyInput(true);
      setJourneyName('');
      form.reset();
      setResumeUrl('');
      setSessionPayload(null);
      setGivenName(undefined);
      addDebugEntry('logoutUser() completed');
    } catch (cause) {
      addDebugEntry('logoutUser() failed', { error: String(cause) });
      Alert.alert('Logout failed', String(cause));
    }
  }, [addDebugEntry, form, logoutUser]);

  const onCollectDeviceProfile = useCallback(async (): Promise<void> => {
    if (loading || !hasDeviceProfileCallback) {
      return;
    }

    try {
      addDebugEntry('collectDeviceProfileForJourney() requested', {
        collectors: DEVICE_PROFILE_COLLECTORS,
      });
      const result = await collectDeviceProfileForJourney(journeyClient, [...DEVICE_PROFILE_COLLECTORS]);
      addDebugEntry('collectDeviceProfileForJourney() result', result);

      if (result.type === 'error') {
        Alert.alert('Device profile failed', result.message ?? result.code);
        return;
      }

      if (!form.meta.hasManual && !hasPollingWaitCallback) {
        addDebugEntry('next() payload (device-profile)', { callbacks: [] });
        await next({});
      }
    } catch (cause) {
      addDebugEntry('collectDeviceProfileForJourney() failed', { error: String(cause) });
      Alert.alert('Device profile failed', String(cause));
    }
  }, [
    addDebugEntry,
    hasDeviceProfileCallback,
    hasPollingWaitCallback,
    journeyClient,
    loading,
    next,
    form.meta.hasManual,
  ]);

  const onSubmit = useCallback(async (): Promise<void> => {
    if (loading) {
      return;
    }

    setSubmitIssues(form.issues);

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
      addDebugEntry('next() payload (helper)', {
        callbacks: form.input.callbacks ?? [],
      });
      await next(form.input);
    } catch (cause) {
      Alert.alert('Submit failed', String(cause));
    }
  }, [addDebugEntry, form.canSubmit, form.input, form.issues, loading, next]);

  return (
    <View style={styles.container}>
      {title ? (
        <View style={commonStyles.card}>
          <Text style={styles.panelTitle}>{title}</Text>
        </View>
      ) : null}

      <View style={commonStyles.card}>
        <JourneyStartPanel
          showJourneyInput={showJourneyInput && !hasActiveSession && !isSessionCheckRunning}
          journeyName={journeyName}
          onJourneyNameChange={setJourneyName}
          suggestedJourneys={suggestedJourneys}
          loading={loading || isSessionCheckRunning}
          canStart={!node && !hasActiveSession && !isSessionCheckRunning}
          onStart={onStart}
        />

        {node?.type === 'ContinueNode' ? (
          <JourneyContinuePanel
            form={form}
            loading={loading}
            pollingWaitMs={pollingWaitMs}
            resumeUrl={resumeUrl}
            onResumeUrlChange={setResumeUrl}
            onCollectDeviceProfile={onCollectDeviceProfile}
            onResume={onResume}
            onSubmit={onSubmit}
          />
        ) : null}

        <JourneyStatusPanel
          node={node}
          error={error}
          hasActiveSession={hasActiveSession}
          givenName={givenName}
          onRefreshSession={() => refreshSession(true)}
          onLogout={onLogout}
        />
      </View>

      <JourneySubmitIssuesCard issues={submitIssues} />

      <JourneySessionCard sessionPayload={sessionPayload} />
      <JourneyDebugPanel entries={debugEntries} onClear={clearDebug} />
    </View>
  );
}

/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  useJourney,
  type JourneyClient,
  type JourneyStartOptions,
} from '@ping-identity/rn-journey';
import { colors } from '../../src/styles/colors';
import { commonStyles } from '../../src/styles/common';
import JourneyCallbackForm from './JourneyCallbackForm';
import JourneyDebugPanel from './JourneyDebugPanel';
import JourneySessionCard from './JourneySessionCard';
import JourneyStartPanel from './JourneyStartPanel';
import JourneyStatusPanel from './JourneyStatusPanel';
import { type CallbackEntry, type JourneyCallbackLike } from './callbacks';
import {
  createJourneyDebugEntry,
  sanitizeDebugPayload,
  type JourneyDebugEntry,
} from './debug';
import { useJourneyAutoProgress } from './useJourneyAutoProgress';
import { useJourneyScreenState } from './useJourneyScreenState';
import { useJourneySubmission } from './useJourneySubmission';

const debugEventLimit = 80;

/**
 * Props for a self-contained Journey panel bound to a single Journey client.
 */
export type JourneyClientPanelProps = {
  journeyClient: JourneyClient;
  title?: string;
  startOptions?: JourneyStartOptions;
};

/**
 * Renders a complete Journey experience for one client instance.
 *
 * @param props - Panel props.
 * @returns Journey panel element.
 */
export default function JourneyClientPanel(
  props: JourneyClientPanelProps
): React.ReactElement {
  const { journeyClient, title, startOptions } = props;
  const [node, { start, next, resume, user, logoutUser, loading, error }] =
    useJourney(journeyClient);
  const [debugEntries, setDebugEntries] = useState<JourneyDebugEntry[]>([]);
  const lastNodeSignatureRef = useRef<string>('');

  const addDebugEntry = useCallback((eventTitle: string, payload?: unknown): void => {
    const entry = createJourneyDebugEntry(eventTitle, sanitizeDebugPayload(payload));
    setDebugEntries((previous) => [entry, ...previous].slice(0, debugEventLimit));
  }, []);

  const clearDebug = useCallback((): void => {
    setDebugEntries([]);
  }, []);

  const continueCallbacks = useMemo<JourneyCallbackLike[]>(() => {
    if (!node || node.type !== 'ContinueNode' || !Array.isArray(node.callbacks)) {
      return [];
    }
    return node.callbacks as JourneyCallbackLike[];
  }, [node]);

  const callbackEntries = useMemo<CallbackEntry[]>(() => {
    const typeCounts: Record<string, number> = {};
    return continueCallbacks.map((callback, absoluteIndex) => {
      const typeIndex = typeCounts[callback.type] ?? 0;
      typeCounts[callback.type] = typeIndex + 1;
      return { callback, absoluteIndex, typeIndex };
    });
  }, [continueCallbacks]);

  const {
    inputValues,
    setInputValues,
    journeyId,
    journeyName,
    setJourneyName,
    suggestedJourneys,
    showJourneyInput,
    resumeUrl,
    setResumeUrl,
    givenName,
    sessionPayload,
    saveSuggestion,
    markJourneyStarted,
    markJourneyLoggedOut,
    clearResumeUrl,
    refreshSession,
  } = useJourneyScreenState({
    journeyClient,
    node,
    user,
    callbackEntries,
  });

  const { autoSubmitting, resetAutoProgress } = useJourneyAutoProgress({
    node,
    continueCallbacks,
    journeyClient,
    next,
  });

  const {
    onSubmit,
    onConfirmationSelect,
    hasManualSubmit,
    hasBlockingIntegration,
    hasUnacceptedRequiredAgreements,
  } = useJourneySubmission({
    callbackEntries,
    inputValues,
    next,
    loading,
    autoSubmitting,
    onSubmitPayload: (callbacks, source) => {
      addDebugEntry(`next() payload (${source})`, { callbacks });
    },
  });

  useEffect(() => {
    if (!node) {
      return;
    }

    const signature = `${node.type}:${node.id ?? 'no-id'}`;
    if (lastNodeSignatureRef.current === signature) {
      return;
    }
    lastNodeSignatureRef.current = signature;

    if (node.type === 'ContinueNode') {
      addDebugEntry('Received ContinueNode', {
        id: node.id,
        callbackCount: continueCallbacks.length,
        callbackTypes: callbackEntries.map((entry) => ({
          type: entry.callback.type,
          typeIndex: entry.typeIndex,
        })),
        callbacks: continueCallbacks,
      });
      return;
    }

    addDebugEntry(`Received ${node.type}`, node);
  }, [addDebugEntry, callbackEntries, continueCallbacks, node]);

  const onStart = useCallback(async (): Promise<void> => {
    const trimmedJourneyName = journeyName.trim();
    if (!trimmedJourneyName) {
      Alert.alert('Enter a journey name first');
      return;
    }

    try {
      addDebugEntry('start() requested', { journeyName: trimmedJourneyName });
      resetAutoProgress();
      await saveSuggestion(trimmedJourneyName);
      await start(trimmedJourneyName, startOptions);
      markJourneyStarted();
      addDebugEntry('start() completed');
    } catch (cause) {
      addDebugEntry('start() failed', { error: String(cause) });
      Alert.alert('Failed to start journey', String(cause));
    }
  }, [
    addDebugEntry,
    journeyName,
    markJourneyStarted,
    resetAutoProgress,
    saveSuggestion,
    start,
    startOptions,
  ]);

  const onResume = useCallback(async (): Promise<void> => {
    const trimmedResumeUrl = resumeUrl.trim();
    if (!trimmedResumeUrl) {
      Alert.alert('Paste the resume URL first.');
      return;
    }

    try {
      addDebugEntry('resume() requested', { resumeUrl: trimmedResumeUrl });
      resetAutoProgress();
      await resume(trimmedResumeUrl);
      clearResumeUrl();
      addDebugEntry('resume() completed');
    } catch (cause) {
      addDebugEntry('resume() failed', { error: String(cause) });
      Alert.alert('Resume failed', String(cause));
    }
  }, [addDebugEntry, clearResumeUrl, resetAutoProgress, resume, resumeUrl]);

  const onLogout = useCallback(async (): Promise<void> => {
    try {
      addDebugEntry('logoutUser() requested');
      await logoutUser();
      markJourneyLoggedOut();
      resetAutoProgress();
      addDebugEntry('logoutUser() completed');
    } catch (cause) {
      addDebugEntry('logoutUser() failed', { error: String(cause) });
      Alert.alert('Logout failed', String(cause));
    }
  }, [addDebugEntry, logoutUser, markJourneyLoggedOut, resetAutoProgress]);

  return (
    <View style={styles.container}>
      {title ? (
        <View style={commonStyles.card}>
          <Text style={styles.panelTitle}>{title}</Text>
        </View>
      ) : null}

      <View style={commonStyles.card}>
        <Text style={commonStyles.textSmall}>
          Journey ID: {journeyId || 'Resolving...'}
        </Text>
      </View>

      <View style={commonStyles.card}>
        <JourneyStartPanel
          showJourneyInput={showJourneyInput}
          journeyName={journeyName}
          onJourneyNameChange={setJourneyName}
          suggestedJourneys={suggestedJourneys}
          loading={loading}
          canStart={!node}
          onStart={onStart}
        />

        {node?.type === 'ContinueNode' ? (
          <>
            <JourneyCallbackForm
              callbackEntries={callbackEntries}
              inputValues={inputValues}
              setInputValues={setInputValues}
              loading={loading}
              autoSubmitting={autoSubmitting}
              resumeUrl={resumeUrl}
              setResumeUrl={setResumeUrl}
              onResume={onResume}
              onConfirmationSelect={onConfirmationSelect}
            />

            {hasBlockingIntegration ? (
              <Text style={styles.blockingNote}>
                This node includes callbacks that require extra native integrations
                (FIDO, Protect, IdP, ReCaptcha, or Binding). Configure those modules
                to continue this journey.
              </Text>
            ) : null}

            {hasManualSubmit && !autoSubmitting ? (
              <TouchableOpacity
                style={[
                  commonStyles.buttonPrimary,
                  (loading || hasUnacceptedRequiredAgreements) && styles.disabledButton,
                ]}
                onPress={onSubmit}
                disabled={loading || hasUnacceptedRequiredAgreements}
              >
                <Text style={commonStyles.buttonText}>Continue</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}

        <JourneyStatusPanel
          node={node}
          error={error}
          givenName={givenName}
          onRefreshSession={refreshSession}
          onLogout={onLogout}
        />
      </View>

      <JourneySessionCard sessionPayload={sessionPayload} />
      <JourneyDebugPanel entries={debugEntries} onClear={clearDebug} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  panelTitle: {
    color: colors.textDark,
    fontSize: 18,
    fontWeight: '700',
  },
  blockingNote: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.55,
  },
});

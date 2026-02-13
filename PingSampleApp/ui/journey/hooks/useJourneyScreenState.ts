/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  JourneyClient,
  JourneyNode,
  JourneyUserSession,
} from '@ping-identity/rn-journey';
import {
  type CallbackEntry,
  type InputValues,
  buildKbaDraft,
  callbackKey,
  readBoolean,
  readNumber,
  readString,
} from '../utils/callbacks';

/**
 * Input contract for Journey screen state management.
 */
export type UseJourneyScreenStateParams = {
  journeyClient: JourneyClient;
  node: JourneyNode | null | undefined;
  user: JourneyClient['user'];
  callbackEntries: CallbackEntry[];
};

/**
 * Stateful view model for Journey sample screen UI state.
 *
 * @param params - Hook input params.
 * @returns Screen-level state and state transitions.
 */
export function useJourneyScreenState(params: UseJourneyScreenStateParams) {
  const { journeyClient, node, user, callbackEntries } = params;

  const [inputValues, setInputValues] = useState<InputValues>({});
  const [session, setSession] = useState<JourneyUserSession | null>(null);
  const [givenName, setGivenName] = useState<string>();
  const [journeyId, setJourneyId] = useState<string>('');
  const [journeyName, setJourneyName] = useState('');
  const [suggestedJourneys, setSuggestedJourneys] = useState<string[]>([]);
  const [showJourneyInput, setShowJourneyInput] = useState(true);
  const [resumeUrl, setResumeUrl] = useState('');

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    (async (): Promise<void> => {
      try {
        const id = await journeyClient.getId();
        if (isMountedRef.current) {
          setJourneyId(id);
        }
      } catch {
        // ignore id load failures in sample app
      }
    })();
  }, [journeyClient]);

  useEffect(() => {
    (async (): Promise<void> => {
      try {
        const stored = await AsyncStorage.getItem('recentJourneys');
        if (stored && isMountedRef.current) {
          setSuggestedJourneys(JSON.parse(stored) as string[]);
        }
      } catch {
        // ignore suggestion load failures in sample app
      }
    })();
  }, []);

  useEffect(() => {
    setInputValues((previous) => {
      const nextValues = { ...previous };

      callbackEntries.forEach(({ callback, typeIndex }) => {
        const key = callbackKey(callback.type, typeIndex);
        if (nextValues[key] !== undefined) {
          return;
        }

        switch (callback.type) {
          case 'BooleanAttributeInputCallback':
          case 'TermsAndConditionsCallback':
          case 'ConsentMappingCallback':
            nextValues[key] = readBoolean(callback.accepted ?? callback.value, false);
            break;
          case 'NumberAttributeInputCallback':
            nextValues[key] = readString(callback.value, '');
            break;
          case 'ChoiceCallback':
          case 'ConfirmationCallback':
            nextValues[key] = readNumber(callback.selectedIndex, 0);
            break;
          case 'KbaCreateCallback':
            nextValues[key] = buildKbaDraft(callback);
            break;
          default:
            nextValues[key] = readString(callback.value, '');
            break;
        }
      });

      return nextValues;
    });
  }, [callbackEntries]);

  useEffect(() => {
    if (node?.type !== 'SuccessNode') {
      return;
    }

    (async (): Promise<void> => {
      try {
        const journeyUser = await user();
        if (!journeyUser || !isMountedRef.current) {
          return;
        }

        setSession(journeyUser);
        const firstName = readString(journeyUser.userInfo?.given_name, '');
        setGivenName(firstName || undefined);
      } catch {
        // ignore user hydration failures in sample app
      }
    })();
  }, [node?.type, user]);

  const saveSuggestion = useCallback(
    async (name: string): Promise<void> => {
      const updated = [name, ...suggestedJourneys.filter((item) => item !== name)].slice(
        0,
        5
      );
      setSuggestedJourneys(updated);
      await AsyncStorage.setItem('recentJourneys', JSON.stringify(updated));
    },
    [suggestedJourneys]
  );

  const markJourneyStarted = useCallback((): void => {
    setShowJourneyInput(false);
    setSession(null);
    setGivenName(undefined);
    setInputValues({});
    setResumeUrl('');
  }, []);

  const markJourneyLoggedOut = useCallback((): void => {
    setSession(null);
    setInputValues({});
    setResumeUrl('');
    setJourneyName('');
    setShowJourneyInput(true);
    setGivenName(undefined);
  }, []);

  const clearResumeUrl = useCallback((): void => {
    setResumeUrl('');
  }, []);

  const refreshSession = useCallback(async (): Promise<void> => {
    const refreshedSession = await user();
    setSession(refreshedSession);
  }, [user]);

  const sessionPayload = useMemo(
    () => (session ? JSON.stringify(session, null, 2) : null),
    [session]
  );

  return {
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
  };
}

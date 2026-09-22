/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { JourneyError } from '@ping-identity/rn-journey';

/**
 * Configuration contract for `useJourneyBackchannelController`.
 */
export type UseJourneyBackchannelControllerOptions = {
  /**
   * Journey backchannel start action.
   */
  startBackchannel: (uri: string) => Promise<unknown>;
  /**
   * Debug append helper.
   */
  appendDebug: (title: string, payload?: unknown) => void;
};

/**
 * Backchannel URI state and start handling for AM/AIC transactional
 * authorization demo flows.
 *
 * @param options - Backchannel controller options.
 * @returns Backchannel URI state and start action.
 */
export function useJourneyBackchannelController(
  options: UseJourneyBackchannelControllerOptions,
): {
  /**
   * Current backchannel URI field value.
   */
  backchannelUri: string;
  /**
   * Backchannel URI updater.
   *
   * @param value - Next backchannel URI value.
   * @returns Void.
   */
  setBackchannelUri: (value: string) => void;
  /**
   * Performs backchannel start with current `backchannelUri`.
   *
   * @returns Promise resolved after the start attempt completes.
   */
  onStartBackchannel: () => Promise<void>;
} {
  const { startBackchannel, appendDebug } = options;
  const [backchannelUri, setBackchannelUri] = useState<string>('');

  const onStartBackchannel = useCallback(async (): Promise<void> => {
    const trimmedUri = backchannelUri.trim();
    if (!trimmedUri) {
      Alert.alert('Paste the gateway redirect URI first.');
      return;
    }

    try {
      const node = (await startBackchannel(trimmedUri)) as
        | { type?: string; message?: unknown }
        | undefined;
      // Native surfaces validation failures (malformed URI, host mismatch,
      // missing params) as FailureNode payloads, not promise rejections — the
      // same contract as the native SDKs. Treat non-ErrorNode outcomes as
      // failures in the demo UI so garbage URIs are reported, not "succeeded".
      const failureMessage =
        (node as { type?: string })?.type === 'FailureNode' ||
        (node as { type?: string })?.type === 'ErrorNode'
          ? typeof (node as { message?: unknown })?.message === 'string'
            ? (node as { message: string }).message
            : JSON.stringify(node)
          : null;
      if (failureMessage) {
        appendDebug('Journey backchannel start rejected', {
          uri: trimmedUri,
          nodeType: (node as { type?: string }).type,
          message: failureMessage,
        });
        Alert.alert('Backchannel start rejected', failureMessage);
        return;
      }
      appendDebug('Journey backchannel start succeeded', { uri: trimmedUri });
      setBackchannelUri('');
    } catch (cause) {
      appendDebug('Journey backchannel start failed', {
        cause:
          cause instanceof JourneyError
            ? `[${cause.code}] ${cause.message}`
            : String(cause),
      });
      Alert.alert(
        'Backchannel start failed',
        cause instanceof JourneyError
          ? `[${cause.code}] ${cause.message}`
          : String(cause),
      );
    }
  }, [appendDebug, backchannelUri, startBackchannel]);

  return {
    backchannelUri,
    setBackchannelUri,
    onStartBackchannel,
  };
}

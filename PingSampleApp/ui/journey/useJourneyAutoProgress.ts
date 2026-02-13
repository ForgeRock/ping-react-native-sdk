/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { collectDeviceProfileForJourney } from '@ping-identity/rn-device-profile';
import type { JourneyClient, JourneyNode } from '@ping-identity/rn-journey';
import { nodeKey, readNumber, type JourneyCallbackLike } from './callbacks';

/**
 * Input contract for Journey auto-progress hook.
 */
export type UseJourneyAutoProgressParams = {
  node: JourneyNode | null | undefined;
  continueCallbacks: JourneyCallbackLike[];
  journeyClient: JourneyClient;
  next: JourneyClient['next'];
};

/**
 * Result contract for Journey auto-progress hook.
 */
export type UseJourneyAutoProgressResult = {
  autoSubmitting: boolean;
  resetAutoProgress: () => void;
};

/**
 * Handles automatic progression callbacks (device profile and polling).
 *
 * @param params - Hook input params.
 * @returns Auto-progress state and reset action.
 */
export function useJourneyAutoProgress(
  params: UseJourneyAutoProgressParams
): UseJourneyAutoProgressResult {
  const { node, continueCallbacks, journeyClient, next } = params;

  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const processedNodesRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const resetAutoProgress = useCallback((): void => {
    processedNodesRef.current.clear();
    setAutoSubmitting(false);
  }, []);

  useEffect(() => {
    if (
      node?.type === 'SuccessNode' ||
      node?.type === 'ErrorNode' ||
      node?.type === 'FailureNode'
    ) {
      resetAutoProgress();
    }
  }, [node?.type, resetAutoProgress]);

  useEffect(() => {
    if (!node || node.type !== 'ContinueNode' || continueCallbacks.length === 0) {
      return;
    }

    const deviceProfileCallback = continueCallbacks.find(
      (callback) => callback.type === 'DeviceProfileCallback'
    );
    if (!deviceProfileCallback) {
      return;
    }

    const key = `${nodeKey(node.id, continueCallbacks)}:device-profile`;
    if (processedNodesRef.current.has(key)) {
      return;
    }

    processedNodesRef.current.add(key);
    setAutoSubmitting(true);

    (async (): Promise<void> => {
      try {
        const submission = await collectDeviceProfileForJourney(journeyClient, [
          'platform',
          'hardware',
          'network',
          'location',
        ]);

        if (submission.type === 'success') {
          await next({});
        } else {
          processedNodesRef.current.delete(key);
          Alert.alert('Device profile failed', submission.message ?? submission.code);
        }
      } catch (cause) {
        processedNodesRef.current.delete(key);
        Alert.alert(
          'Device profile failed',
          String(cause instanceof Error ? cause.message : cause)
        );
      } finally {
        if (isMountedRef.current) {
          setAutoSubmitting(false);
        }
      }
    })();
  }, [continueCallbacks, journeyClient, next, node]);

  useEffect(() => {
    if (!node || node.type !== 'ContinueNode' || continueCallbacks.length === 0) {
      return;
    }

    const hasDeviceProfile = continueCallbacks.some(
      (callback) => callback.type === 'DeviceProfileCallback'
    );
    if (hasDeviceProfile) {
      return;
    }

    const pollingCallback = continueCallbacks.find(
      (callback) => callback.type === 'PollingWaitCallback'
    );
    if (!pollingCallback) {
      return;
    }

    const key = `${nodeKey(node.id, continueCallbacks)}:polling`;
    if (processedNodesRef.current.has(key)) {
      return;
    }

    processedNodesRef.current.add(key);
    setAutoSubmitting(true);

    const timeoutMs = Math.max(500, readNumber(pollingCallback.waitTime, 1000));
    const timeout = setTimeout(() => {
      (async (): Promise<void> => {
        try {
          await next({});
        } catch {
          processedNodesRef.current.delete(key);
        } finally {
          if (isMountedRef.current) {
            setAutoSubmitting(false);
          }
        }
      })();
    }, timeoutMs);

    return () => {
      clearTimeout(timeout);
    };
  }, [continueCallbacks, next, node]);

  return {
    autoSubmitting,
    resetAutoProgress,
  };
}

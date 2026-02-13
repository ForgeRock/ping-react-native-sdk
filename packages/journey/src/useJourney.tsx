/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { useCallback, useState } from 'react';
import type {
  JourneyClient,
  JourneyError,
  JourneyNextInput,
  JourneyNode,
  JourneyStartOptions,
  JourneyUserSession,
} from './types';

/**
 * React helper hook for a `JourneyClient`.
 *
 * @param client - Journey client returned by `journey(...)`.
 * @returns Tuple containing current node state and Journey actions.
 */
export function useJourney(client: JourneyClient) {
  const [node, setNode] = useState<JourneyNode | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<JourneyError | null>(null);

  const start = useCallback(
    async (
      journeyName: string,
      options: JourneyStartOptions = {
        forceAuth: false,
        noSession: false,
      }
    ): Promise<JourneyNode> => {
      try {
        setLoading(true);
        setError(null);
        const result = await client.start(journeyName, options);
        setNode(result);
        return result;
      } catch (err) {
        const typed = err as JourneyError;
        setError(typed);
        throw typed;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const next = useCallback(
    async (input: JourneyNextInput = {}): Promise<JourneyNode> => {
      if (!node) {
        const stateError: JourneyError = {
          type: 'state_error',
          error: 'JOURNEY_STATE_ERROR',
          message: 'No active Journey node. Call start() or resume() first.',
        };
        setError(stateError);
        throw stateError;
      }

      try {
        setLoading(true);
        setError(null);
        const nextNode = await client.next(input);
        setNode(nextNode);
        return nextNode;
      } catch (err) {
        const typed = err as JourneyError;
        setError(typed);
        throw typed;
      } finally {
        setLoading(false);
      }
    },
    [client, node]
  );

  const resume = useCallback(
    async (uri: string): Promise<JourneyNode> => {
      try {
        setLoading(true);
        setError(null);
        const resumedNode = await client.resume(uri);
        setNode(resumedNode);
        return resumedNode;
      } catch (err) {
        const typed = err as JourneyError;
        setError(typed);
        throw typed;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const user = useCallback(async (): Promise<JourneyUserSession | null> => {
    return await client.user();
  }, [client]);

  const logoutUser = useCallback(async (): Promise<boolean> => {
    const result = await client.logoutUser();
    setNode(null);
    return result;
  }, [client]);

  const dispose = useCallback(async (): Promise<void> => {
    await client.dispose();
    setNode(null);
    setError(null);
  }, [client]);

  return [
    node,
    {
      start,
      next,
      resume,
      user,
      logoutUser,
      dispose,
      loading,
      error,
    },
  ] as const;
}

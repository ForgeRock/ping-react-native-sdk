import { useCallback, useState } from 'react';
import {
  configureJourney,
  nextNode,
  resumeJourney,
  getSession,
  logout,
  startJourney,
} from './journeyMethods';
import type { JourneyConfig } from './types';
import type { StorageInstance } from '@react-native-pingidentity/storage';

/**
 * useJourney
 * A React hook that provides a declarative API to configure,
 * start, continue, resume, and manage the user session
 * for the Ping Journey SDK.
 */
export function useJourney(
  journeyConfig: JourneyConfig,
  _storage: StorageInstance<any>
) {
  const [node, setNode] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Configure + Start a Journey
  const start = useCallback(
    async (journeyName: string) => {
      try {
        setLoading(true);
        setError(null);

        await configureJourney(journeyConfig);
        const result = await startJourney(journeyName, {
          forceAuth: false,
          noSession: false,
        });

        setNode(result);
        return result;
      } catch (err: any) {
        console.error('❌ useJourney.start error:', err);
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [journeyConfig]
  );

  // Continue a Journey (submit callbacks)
  const next = useCallback(
    async (input: Record<string, any>) => {
      if (!node?.id) return;
      try {
        setLoading(true);
        const nextN = await nextNode(node.id, input);
        setNode(nextN);
        return nextN;
      } catch (err: any) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [node]
  );

  // Resume a suspended Journey
  const resume = useCallback(async (uri: string) => {
    try {
      setLoading(true);
      const resumedNode = await resumeJourney(uri);
      setNode(resumedNode);
      return resumedNode;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Retrieve current user/session info
  const user = useCallback(async () => {
    try {
      const userT = await getSession();
      return userT;
    } catch (err: any) {
      console.error('⚠️ useJourney.user error:', err);
      return null;
    }
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      await logout();
      setNode(null);
    } catch (err) {
      console.error('⚠️ logout failed:', err);
    }
  }, []);

  return [
    node,
    { start, next, resume, user, logoutUser, loading, error },
  ] as const;
}

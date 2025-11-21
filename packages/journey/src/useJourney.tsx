import { useCallback, useState } from "react";
import type { JourneyClient } from "./types";

/**
 * useJourney
 * A React hook that provides a declarative API to configure,
 * start, continue, resume, and manage the user session
 * for the Ping Journey SDK.
 */
export function useJourney(client: JourneyClient) {
  const [node, setNode] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Configure + Start a Journey
  const start = useCallback(
    async (journeyName: string) => {
      try {
        setLoading(true);
        setError(null);

        const result = await client.start(journeyName, {
          forceAuth: false,
          noSession: false,
        });

        setNode(result);
        return result;
      } catch (err: any) {
        console.error("❌ useJourney.start error:", err);
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  // Continue a Journey (submit callbacks)
  const next = useCallback(
    async (input: Record<string, any>) => {
      if (!node?.id) return;
      try {
        setLoading(true);
        const nextN = await client.next(node.id, input);
        setNode(nextN);
        return nextN;
      } catch (err: any) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [node, client]
  );

  // Resume a suspended Journey
  const resume = useCallback(
    async (uri: string) => {
      try {
        setLoading(true);
        const resumedNode = await client.resume(uri);
        setNode(resumedNode);
        return resumedNode;
      } catch (err: any) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  // Retrieve current user/session info
  const user = useCallback(async () => {
    try {
      return await client.user();
    } catch (err: any) {
      console.error("⚠️ useJourney.user error:", err);
      return null;
    }
  }, [client]);

  const logoutUser = useCallback(async () => {
    try {
      await client.logoutUser();
      setNode(null);
    } catch (err) {
      console.error("⚠️ logout failed:", err);
    }
  }, [client]);

  return [
    node,
    { start, next, resume, user, logoutUser, loading, error },
  ] as const;
}
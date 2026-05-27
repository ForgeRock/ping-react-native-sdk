/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { JourneyError } from './types/error.types';
import type {
  JourneyClient,
  JourneyNextInput,
  JourneyNode,
  JourneySSOToken,
  JourneyStartOptions,
  JourneyUserInfo,
  JourneyUserSession,
} from './types';

/**
 * Actions exposed by {@link useJourney}.
 */
export type JourneyHookActions = {
  /**
   * Start a Journey by name.
   *
   * @param journeyName - Journey/tree name configured on the server.
   * @param options - Optional start flags.
   * @returns First Journey node.
   * @throws {JourneyError} When start fails.
   */
  start: (
    journeyName: string,
    options?: JourneyStartOptions,
  ) => Promise<JourneyNode>;

  /**
   * Advance the active Journey node.
   *
   * @param input - Optional callback input payload.
   * @returns Next Journey node.
   * @throws {JourneyError} When no node exists or progression fails.
   */
  next: (input?: JourneyNextInput) => Promise<JourneyNode>;

  /**
   * Resume a suspended Journey using a resume URI.
   *
   * @param uri - Resume URI.
   * @returns Resumed Journey node.
   * @throws {JourneyError} When resume fails.
   */
  resume: (uri: string) => Promise<JourneyNode>;

  /**
   * Resolve the active Journey user session.
   *
   * @returns Current user session or `null`.
   * @throws {JourneyError} When session retrieval fails.
   */
  user: () => Promise<JourneyUserSession | null>;

  /**
   * Refresh active Journey user access token.
   *
   * @returns Refreshed session payload or `null`.
   * @throws {JourneyError} When refresh fails.
   */
  refresh: () => Promise<JourneyUserSession | null>;

  /**
   * Revoke active Journey user access/refresh tokens.
   *
   * @returns `true` when revoke succeeds.
   * @throws {JourneyError} When revoke fails.
   */
  revoke: () => Promise<boolean>;

  /**
   * Resolve active Journey userinfo payload.
   *
   * @returns Userinfo payload or `null`.
   * @throws {JourneyError} When userinfo retrieval fails.
   */
  userinfo: () => Promise<JourneyUserInfo | null>;

  /**
   * Resolve active Journey SSO token payload.
   *
   * @returns SSO token payload or `null`.
   * @throws {JourneyError} When SSO token retrieval fails.
   */
  ssoToken: () => Promise<JourneySSOToken | null>;

  /**
   * Logout the active Journey user/session.
   *
   * @returns `true` when logout succeeds.
   * @throws {JourneyError} When logout fails.
   */
  logoutUser: () => Promise<boolean>;

  /**
   * Dispose native Journey resources.
   *
   * @returns Promise resolved when disposal completes.
   * @throws {JourneyError} When disposal fails.
   */
  dispose: () => Promise<void>;

  /**
   * Indicates whether a Journey action is in progress.
   */
  loading: boolean;

  /**
   * Last hook-level error, if any.
   */
  error: JourneyError | null;
};

/**
 * Tuple result returned by {@link useJourney}.
 */
export type JourneyHookResult = readonly [
  JourneyNode | null,
  JourneyHookActions,
];

type JourneyContextValue = {
  client: JourneyClient;
  journey: JourneyHookResult;
};

const JourneyContext = createContext<JourneyContextValue | null>(null);

const missingJourneyClientError = new JourneyError(
  'No Journey client found. Use useJourney(client) or wrap your tree with <JourneyProvider client={...}>.',
  'JOURNEY_STATE_ERROR',
  'state_error',
);

const missingJourneyClient: JourneyClient = {
  async init(): Promise<string> {
    throw missingJourneyClientError;
  },
  async getId(): Promise<string> {
    throw missingJourneyClientError;
  },
  async start(): Promise<JourneyNode> {
    throw missingJourneyClientError;
  },
  async next(): Promise<JourneyNode> {
    throw missingJourneyClientError;
  },
  async resume(): Promise<JourneyNode> {
    throw missingJourneyClientError;
  },
  async user(): Promise<JourneyUserSession | null> {
    throw missingJourneyClientError;
  },
  async refresh(): Promise<JourneyUserSession | null> {
    throw missingJourneyClientError;
  },
  async revoke(): Promise<boolean> {
    throw missingJourneyClientError;
  },
  async userinfo(): Promise<JourneyUserInfo | null> {
    throw missingJourneyClientError;
  },
  async ssoToken(): Promise<JourneySSOToken | null> {
    throw missingJourneyClientError;
  },
  async logoutUser(): Promise<boolean> {
    throw missingJourneyClientError;
  },
  async dispose(): Promise<void> {
    throw missingJourneyClientError;
  },
};

/**
 * Props for {@link JourneyProvider}.
 */
export type JourneyProviderProps = {
  /**
   * Journey client shared across a screen tree.
   */
  client: JourneyClient;
  /**
   * Descendant React nodes.
   */
  children: React.ReactNode;
};

/**
 * Shares one `useJourney` state instance across multiple descendant screens/components.
 *
 * @param props - Provider props.
 * @returns Journey context provider element.
 */
export function JourneyProvider(
  props: JourneyProviderProps,
): React.ReactElement {
  const { client, children } = props;
  const journey = useJourneyState(client);
  const value = useMemo<JourneyContextValue>(
    () => ({ client, journey }),
    [client, journey],
  );

  return (
    <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>
  );
}

/**
 * Internal state machine for a Journey client.
 *
 * @param client - Journey client instance.
 * @returns Tuple containing current node state and Journey actions.
 */
function useJourneyState(client: JourneyClient): JourneyHookResult {
  const [node, setNode] = useState<JourneyNode | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<JourneyError | null>(null);

  const start = useCallback(
    async (
      journeyName: string,
      options: JourneyStartOptions = {
        forceAuth: false,
        noSession: false,
      },
    ): Promise<JourneyNode> => {
      try {
        setLoading(true);
        setError(null);
        const result = await client.start(journeyName, options);
        setNode(result);
        return result;
      } catch (err) {
        const typed = JourneyError.from(err);
        setError(typed);
        throw typed;
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const next = useCallback(
    async (input: JourneyNextInput = {}): Promise<JourneyNode> => {
      if (!node) {
        const stateError = new JourneyError(
          'No active Journey node. Call start() or resume() first.',
          'JOURNEY_STATE_ERROR',
          'state_error',
        );
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
        const typed = JourneyError.from(err);
        setError(typed);
        throw typed;
      } finally {
        setLoading(false);
      }
    },
    [client, node],
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
        const typed = JourneyError.from(err);
        setError(typed);
        throw typed;
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const user = useCallback(async (): Promise<JourneyUserSession | null> => {
    return await client.user();
  }, [client]);

  const refresh = useCallback(async (): Promise<JourneyUserSession | null> => {
    return await client.refresh();
  }, [client]);

  const revoke = useCallback(async (): Promise<boolean> => {
    return await client.revoke();
  }, [client]);

  const userinfo = useCallback(async (): Promise<JourneyUserInfo | null> => {
    return await client.userinfo();
  }, [client]);

  const ssoToken = useCallback(async (): Promise<JourneySSOToken | null> => {
    return await client.ssoToken();
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
      refresh,
      revoke,
      userinfo,
      ssoToken,
      logoutUser,
      dispose,
      loading,
      error,
    },
  ] as const;
}

/**
 * React helper hook for Journey flows.
 *
 * @remarks
 * Provide a `client` directly for local screen state, or omit it when using
 * {@link JourneyProvider} to share one Journey state across multiple screens.
 *
 * @param client - Optional Journey client returned by `createJourneyClient(...)`.
 * @returns Tuple containing current node state and Journey actions.
 * @throws {JourneyError} When no client is available via argument or provider.
 */
export function useJourney(client: JourneyClient): JourneyHookResult;
export function useJourney(): JourneyHookResult;
export function useJourney(client?: JourneyClient): JourneyHookResult {
  const contextValue = useContext(JourneyContext);
  const localJourney = useJourneyState(
    client ?? contextValue?.client ?? missingJourneyClient,
  );

  if (client) {
    return localJourney;
  }

  if (contextValue) {
    return contextValue.journey;
  }

  throw missingJourneyClientError;
}

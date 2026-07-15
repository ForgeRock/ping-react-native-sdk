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
import { createDaVinciClient } from './davinci';
import { DaVinciError } from './types/error.types';
import type {
  DaVinciClient,
  DaVinciConfig,
  DaVinciNextInput,
  DaVinciNode,
  DaVinciUserSession,
} from './types';

/**
 * Actions and derived state exposed by {@link useDaVinci}.
 *
 * @public
 */
export type DaVinciHookActions = {
  /**
   * Start the active DaVinci flow.
   *
   * @returns First flow node.
   * @throws {DaVinciError} When start fails.
   */
  start: () => Promise<DaVinciNode>;

  /**
   * Advance the active DaVinci flow node by submitting collector values.
   *
   * @param input - Key-indexed collector values to apply before advancing.
   * @returns Next flow node.
   * @throws {DaVinciError} When value application or progression fails.
   */
  next: (input: DaVinciNextInput) => Promise<DaVinciNode>;

  /**
   * Resolve the active user session.
   *
   * @returns Session payload, or `null` when no active session.
   * @throws {DaVinciError} When session retrieval fails.
   */
  user: () => Promise<DaVinciUserSession | null>;
  /**
   * Refresh the active user session tokens.
   *
   * @returns Refreshed session payload, or `null` when no active session.
   * @throws {DaVinciError} When refresh fails.
   */
  refresh: () => Promise<DaVinciUserSession | null>;
  /**
   * Revoke active user access/refresh tokens.
   *
   * @returns `true` when revocation completes.
   * @throws {DaVinciError} When revocation fails.
   */
  revoke: () => Promise<boolean>;
  /**
   * Resolve userinfo claims for the active session.
   *
   * @returns Userinfo payload, or `null` when no active session.
   * @throws {DaVinciError} When userinfo retrieval fails.
   */
  userinfo: () => Promise<Record<string, unknown> | null>;
  /**
   * Log out the active user and clear session state.
   *
   * @throws {DaVinciError} When logout fails.
   */
  logoutUser: () => Promise<void>;
  /**
   * Dispose the native DaVinci instance and reset local hook state.
   *
   * @throws {DaVinciError} When disposal fails.
   */
  dispose: () => Promise<void>;

  /**
   * Indicates whether `start` or `next` is in progress.
   *
   * @remarks
   * `loading` and `error` are scoped to the node-rendering state machine — they gate
   * the form UI between successive `start`/`next` submissions and reflect the state
   * of the `node` value the component tree renders from.
   *
   * Session operations (`user`, `refresh`, `revoke`, `userinfo`, `logoutUser`,
   * `dispose`) are called imperatively and their callers consume results directly
   * via the returned `Promise`; there is no shared node state to gate, so callers
   * that need per-operation loading or error feedback should manage that locally.
   */
  loading: boolean;
  /** Last hook-level error, if any. */
  error: DaVinciError | null;
};

/**
 * Combined hook result returned by {@link useDaVinci}.
 *
 * @public
 */
export type DaVinciHookResult = DaVinciHookActions & {
  /** Current DaVinci node, or `null` before the flow starts. */
  node: DaVinciNode | null;
};

/**
 * Internal React context value holding the shared DaVinci client and hook result.
 */
type DaVinciContextValue = {
  client: DaVinciClient;
  davinci: DaVinciHookResult;
};

const DaVinciContext = createContext<DaVinciContextValue | null>(null);

const missingDaVinciClientError = new DaVinciError(
  'No DaVinci client found. Use useDaVinci(client) or wrap your tree with <DaVinciProvider config={...}>.',
  'DAVINCI_STATE_ERROR',
  'state_error',
);

const missingDaVinciClient: DaVinciClient = {
  async start(): Promise<DaVinciNode> {
    throw missingDaVinciClientError;
  },
  async next(): Promise<DaVinciNode> {
    throw missingDaVinciClientError;
  },
  async user(): Promise<DaVinciUserSession | null> {
    throw missingDaVinciClientError;
  },
  async refresh(): Promise<DaVinciUserSession | null> {
    throw missingDaVinciClientError;
  },
  async revoke(): Promise<boolean> {
    throw missingDaVinciClientError;
  },
  async userinfo(): Promise<Record<string, unknown> | null> {
    throw missingDaVinciClientError;
  },
  async logoutUser(): Promise<void> {
    throw missingDaVinciClientError;
  },
  async dispose(): Promise<void> {
    throw missingDaVinciClientError;
  },
};

/**
 * Internal state machine for a DaVinci client.
 *
 * @param client - DaVinci client instance.
 * @returns Combined hook result.
 */
function useDaVinciState(client: DaVinciClient): DaVinciHookResult {
  const [node, setNode] = useState<DaVinciNode | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<DaVinciError | null>(null);

  const start = useCallback(async (): Promise<DaVinciNode> => {
    try {
      setLoading(true);
      setError(null);
      const result = await client.start();
      setNode(result);
      return result;
    } catch (err) {
      const typed = DaVinciError.from(err);
      setError(typed);
      throw typed;
    } finally {
      setLoading(false);
    }
  }, [client]);

  const next = useCallback(
    async (input: DaVinciNextInput): Promise<DaVinciNode> => {
      if (!node || node.type !== 'ContinueNode') {
        const stateError = new DaVinciError(
          'next() can only be called on an active ContinueNode.',
          'DAVINCI_STATE_ERROR',
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
        const typed = DaVinciError.from(err);
        setError(typed);
        throw typed;
      } finally {
        setLoading(false);
      }
    },
    [client, node],
  );

  const user = useCallback(
    async (): Promise<DaVinciUserSession | null> => await client.user(),
    [client],
  );

  const refresh = useCallback(
    async (): Promise<DaVinciUserSession | null> => await client.refresh(),
    [client],
  );

  const revoke = useCallback(async (): Promise<boolean> => {
    const result = await client.revoke();
    if (result) {
      setNode(null);
    }
    return result;
  }, [client]);

  const userinfo = useCallback(
    async (): Promise<Record<string, unknown> | null> =>
      await client.userinfo(),
    [client],
  );

  const logoutUser = useCallback(async (): Promise<void> => {
    await client.logoutUser();
    setNode(null);
  }, [client]);

  const dispose = useCallback(async (): Promise<void> => {
    await client.dispose();
    setNode(null);
    setError(null);
  }, [client]);

  return {
    node,
    start,
    next,
    user,
    refresh,
    revoke,
    userinfo,
    logoutUser,
    dispose,
    loading,
    error,
  };
}

/**
 * Props for {@link DaVinciProvider}.
 *
 * @public
 */
export type DaVinciProviderProps = {
  /**
   * DaVinci client configuration.
   *
   * @remarks
   * The provider creates a single {@link DaVinciClient} from this config
   * and shares it across all descendant {@link useDaVinci} calls.
   */
  config: DaVinciConfig;
  /** Descendant React nodes. */
  children: React.ReactNode;
};

/**
 * Shares one `useDaVinci` state instance across multiple descendant screens.
 *
 * @param props - Provider props.
 * @returns DaVinci context provider element.
 *
 * @example
 * ```tsx
 * <DaVinciProvider config={davinciConfig}>
 *   <AppNavigator />
 * </DaVinciProvider>
 * ```
 *
 * @public
 */
export function DaVinciProvider(
  props: DaVinciProviderProps,
): React.ReactElement {
  const { config, children } = props;
  const client = useMemo<DaVinciClient>(
    () => createDaVinciClient(config),
    [config],
  );
  const davinci = useDaVinciState(client);
  const value = useMemo<DaVinciContextValue>(
    () => ({ client, davinci }),
    [client, davinci],
  );

  return (
    <DaVinciContext.Provider value={value}>{children}</DaVinciContext.Provider>
  );
}

/**
 * React helper hook for DaVinci flows.
 *
 * @remarks
 * Provide a `client` directly for local screen state, or omit it when using
 * {@link DaVinciProvider} to share one DaVinci state across multiple screens.
 *
 * Use {@link useDaVinciForm} on top of this hook to manage form values and
 * build submit payloads for the active node.
 *
 * @param client - Optional DaVinci client returned by `createDaVinciClient(...)`.
 * @returns Node + flow-control + session methods.
 * @throws {DaVinciError} When no client is available via argument or provider.
 *
 * @example
 * With an explicit client:
 * ```ts
 * const client = createDaVinciClient({ modules: { oidc: { ... } } });
 * const { node, start, next, loading, error } = useDaVinci(client);
 * ```
 *
 * @example
 * Using context (inside a {@link DaVinciProvider}):
 * ```ts
 * const { node, start, next, loading, error } = useDaVinci();
 * ```
 *
 * @public
 */
export function useDaVinci(client: DaVinciClient): DaVinciHookResult;
export function useDaVinci(): DaVinciHookResult;
export function useDaVinci(client?: DaVinciClient): DaVinciHookResult {
  const contextValue = useContext(DaVinciContext);
  const localDaVinci = useDaVinciState(
    client ?? contextValue?.client ?? missingDaVinciClient,
  );

  if (client) {
    return localDaVinci;
  }

  if (contextValue) {
    return contextValue.davinci;
  }

  throw missingDaVinciClientError;
}

/**
 * Exposes the {@link DaVinciContext} value for use by {@link useDaVinciForm}
 * when consuming a provider-managed client.
 *
 * @returns Context value containing the shared client and hook result, or `null` when called outside a provider.
 * @internal
 */
export function useDaVinciContext(): DaVinciContextValue | null {
  return useContext(DaVinciContext);
}

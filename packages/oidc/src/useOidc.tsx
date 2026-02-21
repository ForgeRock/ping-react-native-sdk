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
  useRef,
  useState,
} from 'react';
import type {
  OidcAuthorizeOptions,
  OidcAuthorizeResult,
  OidcError,
  OidcUser,
  OidcWebClient,
} from './types';
import type { Tokens } from '@ping-identity/rn-types';

/**
 * Serializable token payload returned by OIDC user operations.
 */
type OidcTokenSet = Omit<Tokens, 'tokenExpiry'>;

/**
 * Read-only state snapshot exposed by {@link useOidc}.
 */
export type OidcHookState = {
  /**
   * Whether a hook action is currently in progress.
   */
  isLoading: boolean;
  /**
   * Whether an authenticated OIDC user is currently available.
   */
  isAuthenticated: boolean;
  /**
   * Last resolved OIDC user handle.
   */
  user: OidcUser | null;
  /**
   * Last resolved token payload.
   */
  tokens: OidcTokenSet | null;
  /**
   * Last resolved userinfo payload.
   */
  userInfo: Record<string, unknown> | null;
  /**
   * Last authorize result.
   */
  authorizeResult: OidcAuthorizeResult | null;
  /**
   * Last hook-level error.
   */
  error: OidcError | null;
};

/**
 * Actions exposed by {@link useOidc}.
 *
 * @remarks
 * All async actions reject with {@link OidcError} when native calls fail.
 */
export type OidcHookActions = {
  /**
   * Resolve and cache current auth state from the web client.
   *
   * @returns Resolved user handle, or `null` when no user is available.
   * @throws {OidcError} When native `user()` fails.
   */
  restore: () => Promise<OidcUser | null>;
  /**
   * Launch browser authorization.
   *
   * @param options Optional request overrides for authorize.
   * @returns Authorize outcome.
   * @throws {OidcError} When authorization fails.
   */
  authorize: (options?: OidcAuthorizeOptions) => Promise<OidcAuthorizeResult>;
  /**
   * Resolve and cache token payload for the active user.
   *
   * @returns Token payload, or `null` when no user is available.
   * @throws {OidcError} When token retrieval fails.
   */
  token: () => Promise<OidcTokenSet | null>;
  /**
   * Refresh and cache token payload for the active user.
   *
   * @returns Refreshed token payload, or `null` when no user is available.
   * @throws {OidcError} When refresh fails.
   */
  refresh: () => Promise<OidcTokenSet | null>;
  /**
   * Resolve and cache userinfo payload for the active user.
   *
   * @param cache Whether native userinfo cache should be used.
   * @returns Userinfo payload, or `null` when no user is available.
   * @throws {OidcError} When userinfo retrieval fails.
   */
  userinfo: (cache?: boolean) => Promise<Record<string, unknown> | null>;
  /**
   * Revoke tokens for the active user.
   *
   * @returns `true` when revoke is executed for a resolved user, otherwise `false`.
   * @throws {OidcError} When revoke fails.
   */
  revoke: () => Promise<boolean>;
  /**
   * Logout active user.
   *
   * @returns `true` when logout is executed for a resolved user, otherwise `false`.
   * @throws {OidcError} When logout fails.
   */
  logout: () => Promise<boolean>;
  /**
   * Clears transient hook state.
   *
   * @returns Void.
   */
  clear: () => void;
};

/**
 * Tuple returned by {@link useOidc}.
 */
export type OidcHookResult = readonly [OidcHookState, OidcHookActions];

type OidcContextValue = {
  client: OidcWebClient;
  oidc: OidcHookResult;
};

const OidcContext = createContext<OidcContextValue | null>(null);

const missingOidcClientError: OidcError = {
  type: 'state_error',
  error: 'OIDC_STATE_ERROR',
  message: 'No OIDC client found. Use useOidc(client) or wrap with <OidcProvider client={...}>.',
};

/**
 * Coerces unknown thrown values into the shared OIDC error contract.
 *
 * @param value Thrown value from native/JS action execution.
 * @returns Normalized OIDC error object.
 */
function toOidcError(value: unknown): OidcError {
  const asRecord =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  const type = asRecord?.type;
  const error = asRecord?.error;
  const message = asRecord?.message;

  if (typeof type === 'string' && typeof error === 'string' && typeof message === 'string') {
    return {
      ...asRecord,
      type,
      error,
      message,
    } as OidcError;
  }

  if (value instanceof Error) {
    return {
      ...missingOidcClientError,
      message: value.message,
    };
  }

  return missingOidcClientError;
}

const missingOidcWebClient: OidcWebClient = {
  id: 'missing-oidc-client',
  async authorize() {
    throw missingOidcClientError;
  },
  async user() {
    throw missingOidcClientError;
  },
};

/**
 * Props for {@link OidcProvider}.
 */
export type OidcProviderProps = {
  /**
   * OIDC web client shared across descendants.
   */
  client: OidcWebClient;
  /**
   * Descendant React nodes.
   */
  children: React.ReactNode;
};

/**
 * Shares one OIDC hook state instance across a subtree.
 *
 * @example
 * ```tsx
 * <OidcProvider client={oidcWebClient}>
 *   <OidcScreen />
 * </OidcProvider>
 * ```
 *
 * @param props - Provider props.
 * @param props.client - Shared OIDC web client for descendants.
 * @param props.children - Descendant tree that consumes {@link useOidc}.
 * @returns OIDC provider element.
 */
export function OidcProvider(props: OidcProviderProps): React.ReactElement {
  const { client, children } = props;
  const oidc = useOidcState(client);
  const value = useMemo<OidcContextValue>(() => ({ client, oidc }), [client, oidc]);
  return <OidcContext.Provider value={value}>{children}</OidcContext.Provider>;
}

/**
 * Internal OIDC hook state machine.
 *
 * @param client Native-backed OIDC web client.
 * @returns OIDC hook tuple.
 */
function useOidcState(client: OidcWebClient): OidcHookResult {
  const activeActionCountRef = useRef<number>(0);
  const restoreInFlightRef = useRef<Promise<OidcUser | null> | null>(null);
  const lastRestoreHasUserRef = useRef<boolean | null>(null);
  const lastRestoreUserIdRef = useRef<OidcUser | null>(null);
  const userRef = useRef<OidcUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<OidcUser | null>(null);
  const [tokens, setTokens] = useState<OidcTokenSet | null>(null);
  const [userInfo, setUserInfo] = useState<Record<string, unknown> | null>(null);
  const [authorizeResult, setAuthorizeResult] = useState<OidcAuthorizeResult | null>(null);
  const [error, setError] = useState<OidcError | null>(null);

  /**
   * Clears non-auth transient OIDC hook state.
   *
   * @returns Void.
   */
  const clear = useCallback((): void => {
    setTokens(null);
    setUserInfo(null);
    setAuthorizeResult(null);
    setError(null);
  }, []);

  const clearAuthState = useCallback((): void => {
    setIsAuthenticated(false);
    setUser(null);
    setTokens(null);
    setUserInfo(null);
    userRef.current = null;
    lastRestoreHasUserRef.current = false;
    lastRestoreUserIdRef.current = null;
  }, []);

  const withAction = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      try {
        activeActionCountRef.current += 1;
        if (activeActionCountRef.current === 1) {
          setIsLoading(true);
        }
        setError(null);
        return await action();
      } catch (err) {
        const typed = toOidcError(err);
        setError(typed);
        throw typed;
      } finally {
        activeActionCountRef.current = Math.max(0, activeActionCountRef.current - 1);
        if (activeActionCountRef.current === 0) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  /**
   * Restores current auth state from the underlying web client.
   *
   * @returns Resolved user handle, or `null` when no user exists.
   * @throws {OidcError} When native auth-state resolution fails.
   */
  const restore = useCallback(async (): Promise<OidcUser | null> => {
    if (restoreInFlightRef.current) {
      return await restoreInFlightRef.current;
    }

    const restorePromise = (async (): Promise<OidcUser | null> => {
      try {
        setError(null);

        const resolvedUser = await client.user();
        if (!resolvedUser) {
          if (lastRestoreHasUserRef.current !== false) {
            clearAuthState();
            lastRestoreHasUserRef.current = false;
            lastRestoreUserIdRef.current = null;
          }
          return null;
        }

        // Avoid redundant state writes if the resolved user hasn't changed.
        if (
          lastRestoreHasUserRef.current !== true ||
          lastRestoreUserIdRef.current !== resolvedUser
        ) {
          setUser(resolvedUser);
          userRef.current = resolvedUser;
          setIsAuthenticated(true);
          lastRestoreHasUserRef.current = true;
          lastRestoreUserIdRef.current = resolvedUser;
        }
        return resolvedUser;
      } catch (err) {
        const typed = toOidcError(err);
        setError(typed);
        throw typed;
      } finally {
        restoreInFlightRef.current = null;
      }
    })();

    restoreInFlightRef.current = restorePromise;
    return await restorePromise;
  }, [clearAuthState, client]);

  const resolveCurrentUser = useCallback(async (): Promise<OidcUser | null> => {
    if (userRef.current) {
      return userRef.current;
    }
    return await restore();
  }, [restore]);

  /**
   * Launches browser authorization and updates local auth state.
   *
   * @param options - Optional authorization request overrides.
   * @returns Authorization outcome.
   * @throws {OidcError} When authorization fails.
   */
  const authorize = useCallback(
    async (options?: OidcAuthorizeOptions): Promise<OidcAuthorizeResult> => {
      return await withAction(async () => {
        const result = await client.authorize(options);
        setAuthorizeResult(result);
        if (result.type === 'success') {
          await restore();
        } else {
          clearAuthState();
        }
        return result;
      });
    },
    [clearAuthState, client, restore, withAction]
  );

  /**
   * Resolves token payload for the current user.
   *
   * @returns Token payload, or `null` when no user exists.
   * @throws {OidcError} When token retrieval fails.
   */
  const token = useCallback(async (): Promise<OidcTokenSet | null> => {
    return await withAction(async () => {
      const resolvedUser = await resolveCurrentUser();
      if (!resolvedUser) {
        return null;
      }
      const nextTokens = await resolvedUser.token();
      setTokens(nextTokens);
      setIsAuthenticated(true);
      return nextTokens;
    });
  }, [resolveCurrentUser, withAction]);

  /**
   * Refreshes token payload for the current user.
   *
   * @returns Refreshed token payload, or `null` when no user exists.
   * @throws {OidcError} When refresh fails.
   */
  const refresh = useCallback(async (): Promise<OidcTokenSet | null> => {
    return await withAction(async () => {
      const resolvedUser = await resolveCurrentUser();
      if (!resolvedUser) {
        return null;
      }
      const refreshedTokens = await resolvedUser.refresh();
      setTokens(refreshedTokens);
      setIsAuthenticated(true);
      return refreshedTokens;
    });
  }, [resolveCurrentUser, withAction]);

  /**
   * Resolves userinfo payload for the current user.
   *
   * @param cache - Whether cached userinfo may be used.
   * @returns Userinfo payload, or `null` when no user exists.
   * @throws {OidcError} When userinfo retrieval fails.
   */
  const userinfo = useCallback(
    async (cache = false): Promise<Record<string, unknown> | null> => {
      return await withAction(async () => {
        const resolvedUser = await resolveCurrentUser();
        if (!resolvedUser) {
          return null;
        }
        const nextUserInfo = await resolvedUser.userinfo(cache);
        setUserInfo(nextUserInfo);
        setIsAuthenticated(true);
        return nextUserInfo;
      });
    },
    [resolveCurrentUser, withAction]
  );

  /**
   * Revokes tokens for the current user.
   *
   * @returns `true` when revoke executes for a resolved user, otherwise `false`.
   * @throws {OidcError} When revoke fails.
   */
  const revoke = useCallback(async (): Promise<boolean> => {
    return await withAction(async () => {
      const resolvedUser = await resolveCurrentUser();
      if (!resolvedUser) {
        clearAuthState();
        return false;
      }
      await resolvedUser.revoke();
      clearAuthState();
      return true;
    });
  }, [clearAuthState, resolveCurrentUser, withAction]);

  /**
   * Logs out the current user.
   *
   * @returns `true` when logout executes for a resolved user, otherwise `false`.
   * @throws {OidcError} When logout fails.
   */
  const logout = useCallback(async (): Promise<boolean> => {
    return await withAction(async () => {
      const resolvedUser = await resolveCurrentUser();
      if (!resolvedUser) {
        clearAuthState();
        return false;
      }
      await resolvedUser.logout();
      clearAuthState();
      return true;
    });
  }, [clearAuthState, resolveCurrentUser, withAction]);

  const stateValue = useMemo<OidcHookState>(
    () => ({
      isLoading,
      isAuthenticated,
      user,
      tokens,
      userInfo,
      authorizeResult,
      error,
    }),
    [authorizeResult, error, isAuthenticated, isLoading, tokens, user, userInfo]
  );

  const actionsValue = useMemo<OidcHookActions>(
    () => ({
      restore,
      authorize,
      token,
      refresh,
      userinfo,
      revoke,
      logout,
      clear,
    }),
    [authorize, clear, logout, refresh, restore, revoke, token, userinfo]
  );

  return [stateValue, actionsValue];
}

/**
 * Access OIDC state/actions from a provided or contextual client.
 *
 * @remarks
 * Resolution order:
 * 1. Explicit `client` argument.
 * 2. Nearest {@link OidcProvider} context.
 * 3. Internal missing-client fallback that surfaces state errors on action calls.
 *
 * @example
 * Using context:
 * ```ts
 * const [state, actions] = useOidc();
 * ```
 *
 * @example
 * Using an explicit client:
 * ```ts
 * const [state, actions] = useOidc(oidcWebClient);
 * ```
 *
 * @param client - Optional explicit OIDC web client.
 * @returns Tuple of current OIDC state and actions.
 */
export function useOidc(client?: OidcWebClient): OidcHookResult {
  const context = useContext(OidcContext);

  // Keep hook order stable across renders while preserving provider-shared state.
  const localClient = client ?? context?.client ?? missingOidcWebClient;
  const localOidc = useOidcState(localClient);

  if (!client && context) {
    return context.oidc;
  }
  return localOidc;
}

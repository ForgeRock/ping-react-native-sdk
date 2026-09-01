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
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Tokens } from '@ping-identity/rn-types';
import { deviceOpenVerificationUrl } from './index';
import { OidcError } from './types';
import type {
  OidcAuthorizeResult,
  OidcDeviceAuthorizationResponse,
  OidcDeviceClient,
  OidcDeviceFlowStatus,
  OidcDeviceUser,
} from './types';

/** Token payload exposed by device authorization grant actions. */
export type OidcDeviceTokenSet = Omit<Tokens, 'tokenExpiry'>;

/** State exposed by {@link useDeviceAuthGrant}. */
export type DeviceAuthGrantHookState = {
  /** Latest device authorization status, or null before authorization starts. */
  status: OidcDeviceFlowStatus | null;
  /** Device authorization response emitted when polling starts. */
  authorizationResponse: OidcDeviceAuthorizationResponse | null;
  /** Whether an asynchronous action is in progress. */
  isLoading: boolean;
  /** Whether the initial or an explicit session restore is in progress. */
  isRestoring: boolean;
  /** Whether device authorization polling is currently active. */
  isFlowActive: boolean;
  /** Whether a persisted authenticated user is available. */
  isAuthenticated: boolean;
  /** Authenticated device user, or null when no user is available. */
  user: OidcDeviceUser | null;
  /** Last resolved token payload. */
  tokens: OidcDeviceTokenSet | null;
  /** Last resolved userinfo payload. */
  userInfo: Record<string, unknown> | null;
  /** Last hook-level error, if any. */
  error: OidcError | null;
};

/** Actions exposed by {@link useDeviceAuthGrant}. */
export type DeviceAuthGrantHookActions = {
  /** Restore an authenticated user from the native token store. */
  restore: () => Promise<OidcDeviceUser | null>;
  /** Start device authorization and begin polling for approval. */
  authorize: () => Promise<void>;
  /** Cancel the active device authorization flow. */
  cancel: () => void;
  /**
   * Open the device verification URL in the on-device browser.
   *
   * @param verificationUri - Optional explicit URL. Defaults to the
   * `verificationUriComplete` (falling back to `verificationUri`) from the
   * latest `started` status.
   */
  openVerificationUrl: (
    verificationUri?: string,
  ) => Promise<OidcAuthorizeResult>;
  /** Resolve the current access and ID tokens. */
  token: () => Promise<OidcDeviceTokenSet | null>;
  /** Refresh the current access and ID tokens. */
  refresh: () => Promise<OidcDeviceTokenSet | null>;
  /** Resolve userinfo claims for the current user. */
  userinfo: (cache?: boolean) => Promise<Record<string, unknown> | null>;
  /** Revoke the current device grant. */
  revoke: () => Promise<boolean>;
  /** Log out the current device grant user. */
  logout: () => Promise<boolean>;
  /** Clear transient hook state without revoking the native grant. */
  clear: () => void;
  /** Dispose the native device client and clear hook state. */
  dispose: () => Promise<void>;
};

/** Tuple returned by {@link useDeviceAuthGrant}. */
export type DeviceAuthGrantHookResult = readonly [
  DeviceAuthGrantHookState,
  DeviceAuthGrantHookActions,
];

/** Props for {@link DeviceAuthGrantProvider}. */
export type DeviceAuthGrantProviderProps = {
  /** Device client shared across the descendant screen tree. */
  client: OidcDeviceClient;
  /** Descendant React nodes. */
  children: React.ReactNode;
};

type DeviceAuthGrantContextValue = {
  client: OidcDeviceClient;
  grant: DeviceAuthGrantHookResult;
};

const DeviceAuthGrantContext =
  createContext<DeviceAuthGrantContextValue | null>(null);

const missingDeviceAuthGrantError = new OidcError(
  'No OIDC device client found. Use useDeviceAuthGrant(client) or wrap your tree with <DeviceAuthGrantProvider client={client}>.',
  'OIDC_STATE_ERROR',
  'state_error',
);

const missingDeviceAuthGrantClient: OidcDeviceClient = {
  id: 'missing-oidc-device-client',
  async authorize() {
    throw missingDeviceAuthGrantError;
  },
  async user() {
    throw missingDeviceAuthGrantError;
  },
  async dispose() {
    throw missingDeviceAuthGrantError;
  },
};

const TERMINAL_STATUS_TYPES: ReadonlySet<OidcDeviceFlowStatus['type']> =
  new Set(['success', 'expired', 'accessDenied', 'failure']);

/**
 * Shares one device authorization state instance across descendant screens.
 *
 * The provider restores the user once on mount. It does not dispose the
 * caller-owned client when it unmounts; call `actions.dispose()` when the app
 * is finished with the client.
 *
 * @param props - Provider props.
 * @returns Device authorization provider element.
 */
export function DeviceAuthGrantProvider(
  props: DeviceAuthGrantProviderProps,
): React.ReactElement {
  const { client, children } = props;
  const grant = useDeviceAuthGrantState(client, true);
  const value = useMemo<DeviceAuthGrantContextValue>(
    () => ({ client, grant }),
    [client, grant],
  );

  return (
    <DeviceAuthGrantContext.Provider value={value}>
      {children}
    </DeviceAuthGrantContext.Provider>
  );
}

/**
 * Internal device authorization state machine.
 *
 * @param client - Native-backed device client.
 * @param restoreOnMount - Whether to restore persisted auth state on mount.
 * @returns Device authorization state and actions.
 */
function useDeviceAuthGrantState(
  client: OidcDeviceClient,
  restoreOnMount: boolean,
): DeviceAuthGrantHookResult {
  const mountedRef = useRef<boolean>(true);
  const stopRef = useRef<(() => void) | null>(null);
  const userRef = useRef<OidcDeviceUser | null>(null);
  const restoreInFlightRef = useRef<Promise<OidcDeviceUser | null> | null>(
    null,
  );
  const authorizeInFlightRef = useRef<Promise<void> | null>(null);
  const restoreTokenRef = useRef<number>(0);
  const flowTokenRef = useRef<number>(0);
  const cancelRequestedRef = useRef<boolean>(false);
  const flowTerminalRef = useRef<boolean>(false);
  const activeActionCountRef = useRef<number>(0);
  const [status, setStatus] = useState<OidcDeviceFlowStatus | null>(null);
  const [authorizationResponse, setAuthorizationResponse] =
    useState<OidcDeviceAuthorizationResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<OidcDeviceUser | null>(null);
  const [tokens, setTokens] = useState<OidcDeviceTokenSet | null>(null);
  const [userInfo, setUserInfo] = useState<Record<string, unknown> | null>(
    null,
  );
  const [error, setError] = useState<OidcError | null>(null);

  const clearAuthState = useCallback((): void => {
    userRef.current = null;
    if (!mountedRef.current) return;
    setUser(null);
    setTokens(null);
    setUserInfo(null);
    setIsAuthenticated(false);
  }, []);

  const withAction = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      activeActionCountRef.current += 1;
      if (mountedRef.current && activeActionCountRef.current === 1) {
        setIsLoading(true);
      }
      if (mountedRef.current) setError(null);
      try {
        return await action();
      } catch (cause) {
        const typed = OidcError.from(cause);
        if (mountedRef.current) setError(typed);
        throw typed;
      } finally {
        activeActionCountRef.current = Math.max(
          0,
          activeActionCountRef.current - 1,
        );
        if (mountedRef.current && activeActionCountRef.current === 0) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  const restore = useCallback(async (): Promise<OidcDeviceUser | null> => {
    if (restoreInFlightRef.current) {
      return await restoreInFlightRef.current;
    }

    const restoreToken = ++restoreTokenRef.current;
    const restorePromise = withAction(async () => {
      if (mountedRef.current) setIsRestoring(true);
      const resolvedUser = await client.user();
      if (!mountedRef.current) return resolvedUser;
      if (!resolvedUser) {
        clearAuthState();
        return null;
      }
      userRef.current = resolvedUser;
      setUser(resolvedUser);
      setIsAuthenticated(true);
      return resolvedUser;
    }).finally(() => {
      // See authorize()'s trackedRequest comment: only clear the ref for the
      // generation that owns it, so a superseded restore() (e.g. after a
      // client swap) cannot null out a newer in-flight restore's ref.
      if (restoreToken === restoreTokenRef.current) {
        restoreInFlightRef.current = null;
      }
      if (mountedRef.current) setIsRestoring(false);
    });

    restoreInFlightRef.current = restorePromise;
    return await restorePromise;
  }, [clearAuthState, client, withAction]);

  const resolveCurrentUser =
    useCallback(async (): Promise<OidcDeviceUser | null> => {
      if (userRef.current) return userRef.current;
      return await restore();
    }, [restore]);

  const clear = useCallback((): void => {
    if (!mountedRef.current) return;
    setStatus(null);
    setAuthorizationResponse(null);
    setTokens(null);
    setUserInfo(null);
    setError(null);
  }, []);

  const handleStatus = useCallback(
    (nextStatus: OidcDeviceFlowStatus, flowToken: number): void => {
      if (flowToken !== flowTokenRef.current) return;
      if (TERMINAL_STATUS_TYPES.has(nextStatus.type)) {
        flowTerminalRef.current = true;
        stopRef.current = null;
      }
      if (!mountedRef.current) return;
      setStatus(nextStatus);
      if (nextStatus.type === 'started') {
        setAuthorizationResponse(nextStatus.response);
      }
      if (
        nextStatus.type !== 'success' &&
        TERMINAL_STATUS_TYPES.has(nextStatus.type)
      ) {
        setAuthorizationResponse(null);
      }
      if (nextStatus.type === 'failure') {
        setError(
          new OidcError(
            nextStatus.error.message,
            nextStatus.error.code ?? 'OIDC_AUTHORIZE_ERROR',
            'oidc_error',
            nextStatus.error.status,
          ),
        );
      }
    },
    [],
  );

  const authorize = useCallback(async (): Promise<void> => {
    if (authorizeInFlightRef.current) {
      return await authorizeInFlightRef.current;
    }
    const flowToken = flowTokenRef.current + 1;
    flowTokenRef.current = flowToken;
    cancelRequestedRef.current = false;
    flowTerminalRef.current = false;
    const request = withAction(async () => {
      if (mountedRef.current) {
        setStatus(null);
        setAuthorizationResponse(null);
      }
      let restorePromise: Promise<OidcDeviceUser | null> | null = null;
      const stop = await client.authorize((nextStatus) => {
        handleStatus(nextStatus, flowToken);
        if (
          nextStatus.type === 'success' &&
          flowToken === flowTokenRef.current &&
          !cancelRequestedRef.current
        ) {
          restorePromise = restore();
        }
      });
      if (restorePromise) {
        await restorePromise;
      }
      // cancelRequestedRef/flowTerminalRef are shared across generations and
      // get reset by a subsequent authorize() call, so a superseded flow's
      // native call resolving late must also check flowToken directly —
      // otherwise it could overwrite stopRef.current with this stale flow's
      // stop function after a newer flow has already taken over.
      if (
        cancelRequestedRef.current ||
        flowTerminalRef.current ||
        flowToken !== flowTokenRef.current
      ) {
        stop();
        return;
      }
      if (mountedRef.current) stopRef.current = stop;
    });
    const trackedRequest = request.finally(() => {
      // A cancel() (or a client swap) between this request starting and
      // settling bumps flowTokenRef and clears authorizeInFlightRef itself so
      // a subsequent authorize() can start fresh instead of being deduped
      // against this superseded request. Only clear the ref here when this
      // request is still the current generation, so this stale settlement
      // cannot null out a ref a newer authorize() call has since taken over.
      if (flowToken === flowTokenRef.current) {
        authorizeInFlightRef.current = null;
      }
    });
    authorizeInFlightRef.current = trackedRequest;
    return await trackedRequest;
  }, [client, handleStatus, restore, withAction]);

  const cancel = useCallback((): void => {
    cancelRequestedRef.current = true;
    flowTokenRef.current += 1;
    authorizeInFlightRef.current = null;
    stopRef.current?.();
    stopRef.current = null;
    if (!mountedRef.current) return;
    setStatus(null);
    setAuthorizationResponse(null);
    setError(null);
  }, []);

  const openVerificationUrl = useCallback(
    async (verificationUri?: string): Promise<OidcAuthorizeResult> => {
      const url =
        verificationUri ??
        authorizationResponse?.verificationUriComplete ??
        authorizationResponse?.verificationUri ??
        '';
      return await deviceOpenVerificationUrl(client, url);
    },
    [authorizationResponse, client],
  );

  const token = useCallback(async (): Promise<OidcDeviceTokenSet | null> => {
    return await withAction(async () => {
      const resolvedUser = await resolveCurrentUser();
      if (!resolvedUser) return null;
      const nextTokens = await resolvedUser.token();
      if (mountedRef.current) {
        setTokens(nextTokens);
        setIsAuthenticated(true);
      }
      return nextTokens;
    });
  }, [resolveCurrentUser, withAction]);

  const refresh = useCallback(async (): Promise<OidcDeviceTokenSet | null> => {
    return await withAction(async () => {
      const resolvedUser = await resolveCurrentUser();
      if (!resolvedUser) return null;
      const nextTokens = await resolvedUser.refresh();
      if (mountedRef.current) {
        setTokens(nextTokens);
        setIsAuthenticated(true);
      }
      return nextTokens;
    });
  }, [resolveCurrentUser, withAction]);

  const userinfo = useCallback(
    async (cache = false): Promise<Record<string, unknown> | null> => {
      return await withAction(async () => {
        const resolvedUser = await resolveCurrentUser();
        if (!resolvedUser) return null;
        const nextUserInfo = await resolvedUser.userinfo(cache);
        if (mountedRef.current) {
          setUserInfo(nextUserInfo);
          setIsAuthenticated(true);
        }
        return nextUserInfo;
      });
    },
    [resolveCurrentUser, withAction],
  );

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

  const dispose = useCallback(async (): Promise<void> => {
    stopRef.current?.();
    stopRef.current = null;
    await client.dispose();
    clearAuthState();
    if (mountedRef.current) {
      setStatus(null);
      setAuthorizationResponse(null);
      setError(null);
    }
  }, [clearAuthState, client]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelRequestedRef.current = true;
      flowTokenRef.current += 1;
      stopRef.current?.();
      stopRef.current = null;
      // Clear in-flight refs so a fresh authorize()/restore() against a
      // newly-swapped client is never deduped against a promise tied to the
      // previous client. Bumping restoreTokenRef ensures the previous
      // client's still-pending restore() cannot later null out a newer one.
      authorizeInFlightRef.current = null;
      restoreInFlightRef.current = null;
      restoreTokenRef.current += 1;
    };
  }, [client]);

  useEffect(() => {
    if (!restoreOnMount) return;
    void restore().catch(() => {
      // The typed error is already stored in hook state.
    });
  }, [restore, restoreOnMount]);

  const state = useMemo<DeviceAuthGrantHookState>(
    () => ({
      status,
      authorizationResponse,
      isLoading,
      isRestoring,
      isFlowActive: status !== null && !TERMINAL_STATUS_TYPES.has(status.type),
      isAuthenticated,
      user,
      tokens,
      userInfo,
      error,
    }),
    [
      authorizationResponse,
      error,
      isAuthenticated,
      isLoading,
      isRestoring,
      status,
      tokens,
      user,
      userInfo,
    ],
  );

  const actions = useMemo<DeviceAuthGrantHookActions>(
    () => ({
      restore,
      authorize,
      cancel,
      openVerificationUrl,
      token,
      refresh,
      userinfo,
      revoke,
      logout,
      clear,
      dispose,
    }),
    [
      authorize,
      cancel,
      clear,
      dispose,
      logout,
      openVerificationUrl,
      refresh,
      restore,
      revoke,
      token,
      userinfo,
    ],
  );

  return [state, actions];
}

/**
 * Access device authorization state/actions from a direct or contextual client.
 *
 * @param client - Optional explicit device client.
 * @returns Device authorization state and actions.
 */
export function useDeviceAuthGrant(
  client?: OidcDeviceClient,
): DeviceAuthGrantHookResult {
  const context = useContext(DeviceAuthGrantContext);
  const localClient = client ?? context?.client ?? missingDeviceAuthGrantClient;
  const localGrant = useDeviceAuthGrantState(localClient, false);

  if (!client && context) return context.grant;
  return localGrant;
}

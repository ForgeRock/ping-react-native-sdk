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
  useRef,
  useState,
} from 'react';
import { createPushClient } from './push';
import type {
  PushClient,
  PushConfig,
  PushCredential,
  PushError,
  PushNotification,
} from './types';

/**
 * Push data available when the client is ready.
 */
export type PushData = {
  /**
   * The active push client. Use for mutations (approve, deny, enroll, delete).
   */
  client: PushClient;
  /**
   * All enrolled push credentials.
   */
  credentials: PushCredential[];
  /**
   * Current device push token, or `null` if not yet registered.
   */
  deviceToken: string | null;
  /**
   * Push notifications awaiting a user response.
   */
  pendingNotifications: PushNotification[];
  /**
   * All push notifications stored on the device.
   */
  allNotifications: PushNotification[];
};

/**
 * Actions returned as the second element of the {@link usePush} tuple.
 */
export type PushActions = {
  /**
   * `true` while the client is initialising or data is being fetched.
   */
  loading: boolean;
  /**
   * Last error from client creation or data fetch, if any.
   */
  error: PushError | null;
  /**
   * Re-fetches all push data from the native SDK.
   *
   * Call this after mutations (enroll, delete, approve/deny) to keep
   * displayed state in sync.
   */
  refresh: () => Promise<void>;
};

/**
 * Tuple result returned by {@link usePush}.
 *
 * Mirrors the `useJourney` / `useOidc` tuple pattern used across this SDK family.
 * The first element is `PushData` when ready, `null` while loading or errored.
 */
export type PushResult = readonly [PushData | null, PushActions];

type PushContextValue = PushResult;

const PushContext = createContext<PushContextValue | null>(null);

const missingPushClientError: PushError = {
  type: 'state_error',
  error: 'NOT_INITIALIZED',
  message:
    'No Push client found. Use usePush(config) or wrap your tree with <PushProvider config={...}>.',
};

/**
 * Props for {@link PushProvider}.
 */
export type PushProviderProps = {
  /**
   * Push client configuration passed to `createPushClient()` on mount.
   * Omit to use native defaults.
   */
  config?: PushConfig;
  /**
   * Descendant React nodes.
   */
  children: React.ReactNode;
};

/**
 * Creates a `PushClient` on mount and shares live push state across a
 * descendant screen tree.
 *
 * Handles the full client lifecycle: creation, data fetching, token
 * subscription, and cleanup on unmount. Any descendant can call
 * `usePush()` (no arguments) to access the shared state.
 *
 * @param props - Provider props.
 * @returns Push context provider element.
 */
// Stable empty config object — used when PushProvider is mounted with no config
// so usePushState always sees a non-null value and creates the client.
const DEFAULT_CONFIG: PushConfig = {};

export function PushProvider(props: PushProviderProps): React.ReactElement {
  const { config = DEFAULT_CONFIG, children } = props;
  const result = usePushState(config);
  return <PushContext.Provider value={result}>{children}</PushContext.Provider>;
}

/**
 * Internal hook that owns the full push client lifecycle.
 *
 * When `config` is `null` (no-arg call that will use context instead),
 * the effect is a no-op and state stays at its initial values.
 * The caller discards this result in favour of the context value.
 */
function usePushState(config: PushConfig | null | undefined): PushResult {
  const hasConfig = config !== null && config !== undefined;

  const [data, setData] = useState<PushData | null>(null);
  const [loading, setLoading] = useState(hasConfig);
  const [error, setError] = useState<PushError | null>(null);

  const clientRef = useRef<PushClient | null>(null);

  const refresh = useCallback(async () => {
    const c = clientRef.current;
    if (!c) return;
    setLoading(true);
    setError(null);
    try {
      const [credentials, deviceToken, pendingNotifications, allNotifications] =
        await Promise.all([
          c.getCredentials(),
          c.getDeviceToken(),
          c.getPendingNotifications(),
          c.getAllNotifications(),
        ]);
      setData({
        client: c,
        credentials,
        deviceToken,
        pendingNotifications,
        allNotifications,
      });
    } catch (err) {
      setError(err as PushError);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasConfig) return;

    let mounted = true;
    let unsubToken: (() => void) | null = null;

    createPushClient(config ?? undefined)
      .then((c) => {
        // Component unmounted while createPushClient was in flight — close the
        // newly created client immediately and discard it.
        if (!mounted) {
          c.close().catch(() => {});
          return;
        }
        clientRef.current = c;

        unsubToken = c.onTokenRegistered(() => {
          void refresh();
        });

        Promise.all([
          c.getCredentials(),
          c.getDeviceToken(),
          c.getPendingNotifications(),
          c.getAllNotifications(),
        ])
          .then(
            ([
              credentials,
              deviceToken,
              pendingNotifications,
              allNotifications,
            ]) => {
              if (!mounted) return;
              setData({
                client: c,
                credentials,
                deviceToken,
                pendingNotifications,
                allNotifications,
              });
              setLoading(false);
            },
          )
          .catch((err) => {
            if (!mounted) return;
            setError(err as PushError);
            setLoading(false);
          });
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err as PushError);
        setLoading(false);
      });

    return () => {
      mounted = false;
      unsubToken?.();
      unsubToken = null;
      // Best-effort cleanup — failure here means the bridge is already torn down or the client
      // was already closed, so there is nothing actionable to surface.
      clientRef.current?.close().catch(() => {});
      clientRef.current = null;
      setData(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasConfig, config]);

  return [data, { loading, error, refresh }] as const;
}

/**
 * React hook for push MFA flows.
 *
 * @remarks
 * Creates a `PushClient` on mount, manages the full client lifecycle, and
 * keeps credential/notification/token state fresh automatically.
 *
 * Follows the React Query pattern — check `loading` and `error` first,
 * then destructure `data`. TypeScript narrows `data` to non-null after guards.
 *
 * Omit `config` when used inside {@link PushProvider} to share the
 * provider's state instead of creating a new client.
 *
 * @param config - Optional push client configuration.
 * @returns Push state including data, loading flag, error, and refresh.
 * @throws {PushError} When called outside a `PushProvider` without a `config`.
 *
 * @example
 * ```tsx
 * // Shared state — wrap navigator once:
 * <PushProvider config={myConfig}>
 *   <AppNavigator />
 * </PushProvider>
 *
 * // In any descendant screen:
 * function PushScreen() {
 *   const { data, loading, error, refresh } = usePush();
 *
 *   if (loading) return <ActivityIndicator />;
 *   if (error) return <Text>{error.message}</Text>;
 *
 *   const { client, credentials, deviceToken } = data;
 * }
 * ```
 */
export function usePush(config: PushConfig): PushResult;
export function usePush(): PushResult;
export function usePush(config?: PushConfig): PushResult {
  const contextValue = useContext(PushContext);
  // Always call usePushState so hook call order is stable across renders.
  // When config is undefined and a PushProvider exists, this is a no-op
  // (hasConfig=false) — its result is discarded in favour of contextValue.
  const localResult = usePushState(config ?? null);

  if (config !== undefined) {
    return localResult;
  }

  if (contextValue) {
    return contextValue;
  }

  throw missingPushClientError;
}

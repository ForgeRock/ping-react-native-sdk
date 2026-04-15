/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * UseOidcScenario — headless test screen for useOidc E2E tests.
 *
 * Default mode: mock OidcWebClient (no native calls, no browser).
 * Allows Tier 1 tests to verify hook state transitions
 * (isLoading, isAuthenticated, tokens, userInfo) without a live server.
 *
 * Set PING_OIDC_LIVE_MODE=true to use a real OidcWebClient backed by native.
 *
 * testIDs:
 *   use-oidc-loading          → visible while state.isLoading
 *   use-oidc-authenticated    → visible while state.isAuthenticated
 *   use-oidc-user-result      → visible when state.user is non-null
 *   use-oidc-token-result     → visible when state.tokens is non-null
 *   use-oidc-userinfo-result  → visible when state.userInfo is non-null
 *   use-oidc-error            → visible when state.error is non-null
 *   use-oidc-logged-out       → visible after logout/revoke clears isAuthenticated
 *   use-oidc-authorize-btn    → calls actions.authorize()
 *   use-oidc-restore-btn      → calls actions.restore()
 *   use-oidc-token-btn        → calls actions.token()
 *   use-oidc-refresh-btn              → calls actions.refresh()
 *   use-oidc-refreshed                → visible after refresh() succeeds
 *   use-oidc-refreshed-token-result   → state.tokens.accessToken after refresh (proves hook state updated)
 *   use-oidc-userinfo-btn     → calls actions.userinfo()
 *   use-oidc-revoke-btn       → calls actions.revoke()
 *   use-oidc-logout-btn       → calls actions.logout()
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { LaunchArguments } from 'react-native-launch-arguments';
import {
  createOidcClient,
  createOidcWebClient,
  useOidc,
} from '@ping-identity/rn-oidc';
import type { OidcUser, OidcWebClient } from '@ping-identity/rn-oidc';

// ─── launch args ─────────────────────────────────────────────────────────────

interface OidcLaunchArgs {
  PING_DISCOVERY_ENDPOINT?: string;
  PING_CLIENT_ID?: string;
  PING_REDIRECT_URI?: string;
  PING_OIDC_LIVE_MODE?: string;
}

// ─── mock client (Tier 1 — no native calls) ──────────────────────────────────

const mockUser: OidcUser = {
  token: async () => ({
    accessToken: 'hook-test-access-token',
    idToken: 'hook-test-id-token',
  }),
  refresh: async () => ({
    accessToken: 'hook-test-refreshed-token',
    idToken: 'hook-test-id-token',
  }),
  userinfo: async (_cache?: boolean) => ({
    sub: 'hook-e2e-user',
    email: 'hook-e2e@example.com',
  }),
  revoke: async () => {},
  logout: async () => {},
};

const mockWebClient: OidcWebClient = {
  id: 'hook-test-client',
  authorize: async () => ({ type: 'success' as const }),
  user: async () => mockUser,
};

const errorMockWebClient: OidcWebClient = {
  id: 'hook-test-client-error',
  authorize: async () => {
    throw new Error('Forced test error');
  },
  user: async () => null,
};

// ─── component ───────────────────────────────────────────────────────────────

interface UseOidcScenarioProps {
  forceError?: boolean;
}

export default function UseOidcScenario({
  forceError: forceErrorProp = false,
}: UseOidcScenarioProps): React.JSX.Element {
  const args = LaunchArguments.value<OidcLaunchArgs>();
  const liveMode = args.PING_OIDC_LIVE_MODE === 'true';

  const liveClient = useMemo<OidcWebClient | null>(() => {
    if (!liveMode) {
      return null;
    }
    const oidcClient = createOidcClient({
      discoveryEndpoint: args.PING_DISCOVERY_ENDPOINT ?? '',
      clientId: args.PING_CLIENT_ID ?? '',
      redirectUri:
        args.PING_REDIRECT_URI ?? 'org.forgerock.demo://oauth2redirect',
      scopes: ['openid', 'profile', 'email'],
    });
    return createOidcWebClient(oidcClient);
  }, [
    liveMode,
    args.PING_DISCOVERY_ENDPOINT,
    args.PING_CLIENT_ID,
    args.PING_REDIRECT_URI,
  ]);

  const client: OidcWebClient =
    liveMode && liveClient != null
      ? liveClient
      : forceErrorProp
        ? errorMockWebClient
        : mockWebClient;

  const [state, actions] = useOidc(client);
  const [hasDeauthed, setHasDeauthed] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  const handleAuthorize = useCallback(async () => {
    try {
      await actions.authorize();
    } catch {
      // state.error updated by hook
    }
  }, [actions]);

  const handleRestore = useCallback(async () => {
    try {
      await actions.restore();
    } catch {
      // state.error updated by hook
    }
  }, [actions]);

  const handleToken = useCallback(async () => {
    try {
      await actions.token();
    } catch {
      // state.error updated by hook
    }
  }, [actions]);

  const handleRefresh = useCallback(async () => {
    try {
      await actions.refresh();
      setRefreshed(true);
    } catch {
      // state.error updated by hook
    }
  }, [actions]);

  const handleUserinfo = useCallback(async () => {
    try {
      await actions.userinfo();
    } catch {
      // state.error updated by hook
    }
  }, [actions]);

  const handleRevoke = useCallback(async () => {
    try {
      await actions.revoke();
      setHasDeauthed(true);
    } catch {
      // state.error updated by hook
    }
  }, [actions]);

  const handleLogout = useCallback(async () => {
    try {
      await actions.logout();
      setHasDeauthed(true);
    } catch {
      // state.error updated by hook
    }
  }, [actions]);

  return (
    <View>
      {state.isLoading && <Text testID="use-oidc-loading">Loading…</Text>}
      {state.isAuthenticated && (
        <Text testID="use-oidc-authenticated">Authenticated</Text>
      )}
      {state.user !== null && (
        <Text testID="use-oidc-user-result">User OK</Text>
      )}
      {state.tokens !== null && (
        <Text testID="use-oidc-token-result">Token OK</Text>
      )}
      {refreshed && <Text testID="use-oidc-refreshed">Refreshed</Text>}
      {refreshed && state.tokens !== null && (
        <Text testID="use-oidc-refreshed-token-result">
          {state.tokens.accessToken}
        </Text>
      )}
      {state.userInfo !== null && (
        <Text testID="use-oidc-userinfo-result">Userinfo OK</Text>
      )}
      {state.error !== null && (
        <Text testID="use-oidc-error">{state.error.message}</Text>
      )}
      {hasDeauthed && !state.isAuthenticated && (
        <Text testID="use-oidc-logged-out">Logged out</Text>
      )}

      <Button
        testID="use-oidc-authorize-btn"
        title="Authorize"
        onPress={handleAuthorize}
      />
      <Button
        testID="use-oidc-restore-btn"
        title="Restore"
        onPress={handleRestore}
      />
      <Button testID="use-oidc-token-btn" title="Token" onPress={handleToken} />
      <Button
        testID="use-oidc-refresh-btn"
        title="Refresh"
        onPress={handleRefresh}
      />
      <Button
        testID="use-oidc-userinfo-btn"
        title="Userinfo"
        onPress={handleUserinfo}
      />
      <Button
        testID="use-oidc-revoke-btn"
        title="Revoke"
        onPress={handleRevoke}
      />
      <Button
        testID="use-oidc-logout-btn"
        title="Logout"
        onPress={handleLogout}
      />
    </View>
  );
}

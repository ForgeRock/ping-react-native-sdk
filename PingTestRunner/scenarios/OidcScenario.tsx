/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * OidcScenario — headless test screen for OIDC E2E tests.
 */

import React, { useCallback, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { LaunchArguments } from 'react-native-launch-arguments';
import { createOidcClient, createOidcWebClient } from '@ping-identity/rn-oidc';
import type { OidcWebClient } from '@ping-identity/rn-oidc';

interface OidcLaunchArgs {
  PING_DISCOVERY_ENDPOINT?: string;
  PING_CLIENT_ID?: string;
  PING_REDIRECT_URI?: string;
  PING_OIDC_LIVE_MODE?: string;
  PING_OIDC_TEST_MODE?: string;
  PING_OIDC_TEST_FORCE_ERROR?: string;
}

type ScenarioState = 'idle' | 'authorizing' | 'authorized' | 'error';

interface OidcScenarioProps {
  testScenario?: string;
}

export default function OidcScenario({
  testScenario,
}: OidcScenarioProps): React.JSX.Element {
  const args = LaunchArguments.value<OidcLaunchArgs>();
  const discoveryEndpoint = args.PING_DISCOVERY_ENDPOINT ?? '';
  const clientId = args.PING_CLIENT_ID ?? '';
  const redirectUri =
    args.PING_REDIRECT_URI ?? 'org.forgerock.demo://oauth2redirect';
  const oidcLiveMode = args.PING_OIDC_LIVE_MODE === 'true';
  const oidcTestMode = !oidcLiveMode || args.PING_OIDC_TEST_MODE === 'true';
  const oidcTestForceError =
    args.PING_OIDC_TEST_FORCE_ERROR === 'true' ||
    testScenario === 'oidc-failure';

  const [state, setState] = useState<ScenarioState>('idle');
  const [webClient, setWebClient] = useState<OidcWebClient | null>(null);
  const [userinfo, setUserinfo] = useState<string | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleForceFailure = useCallback(() => {
    setErrorMessage('OIDC test mode: forced authorize failure');
    setState('error');
  }, []);

  const handleAuthorize = useCallback(async () => {
    if (testScenario === 'oidc-failure') {
      setErrorMessage('OIDC test mode: forced authorize failure');
      setState('error');
      return;
    }

    if (oidcTestMode) {
      setErrorMessage(null);
      setState('authorizing');
      if (oidcTestForceError) {
        setErrorMessage('OIDC test mode: forced authorize failure');
        setState('error');
        return;
      }
      setState('authorized');
      return;
    }

    try {
      setState('authorizing');
      const client = createOidcClient({
        discoveryEndpoint: discoveryEndpoint,
        clientId: clientId,
        redirectUri: redirectUri,
        scopes: ['openid', 'profile', 'email'],
      });
      const wc = createOidcWebClient(client);
      setWebClient(wc);
      await wc.authorize();
      setState('authorized');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  }, [
    clientId,
    discoveryEndpoint,
    oidcTestForceError,
    oidcTestMode,
    redirectUri,
    testScenario,
  ]);

  const handleUserinfo = useCallback(async () => {
    if (oidcTestMode) {
      setUserinfo(
        JSON.stringify({
          sub: 'e2e-test-user',
          email: 'e2e-test-user@example.com',
        }),
      );
      return;
    }

    if (!webClient) {
      return;
    }
    try {
      const user = await webClient.user();
      if (user) {
        const info = await user.userinfo();
        setUserinfo(JSON.stringify(info));
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, [oidcTestMode, webClient]);

  const handleLogout = useCallback(async () => {
    if (oidcTestMode) {
      setLoggedOut(true);
      return;
    }

    if (!webClient) {
      return;
    }
    try {
      const user = await webClient.user();
      if (user) {
        await user.logout();
      }
      setLoggedOut(true);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, [oidcTestMode, webClient]);

  return (
    <View>
      <Button
        testID="oidc-authorize-btn"
        title="Authorize"
        onPress={handleAuthorize}
      />
      {oidcTestMode && (
        <Button
          testID="oidc-force-failure-btn"
          title="Force Failure"
          onPress={handleForceFailure}
        />
      )}

      {(state === 'authorizing' ||
        (oidcTestMode && state === 'authorized')) && (
        <Text testID="oidc-browser-open">Browser open…</Text>
      )}

      {state === 'authorized' && (
        <View>
          <Text testID="oidc-token-result">Authorized</Text>
          <Button
            testID="oidc-userinfo-btn"
            title="User Info"
            onPress={handleUserinfo}
          />
          {userinfo !== null && (
            <Text testID="oidc-userinfo-result">{userinfo}</Text>
          )}
          <Button
            testID="oidc-logout-btn"
            title="Logout"
            onPress={handleLogout}
          />
          {loggedOut && <Text testID="oidc-logged-out">Logged out</Text>}
        </View>
      )}

      {state === 'error' && errorMessage !== null && (
        <Text testID="oidc-error-message">{errorMessage}</Text>
      )}
    </View>
  );
}

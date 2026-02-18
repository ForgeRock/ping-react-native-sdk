/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useJourney } from '@ping-identity/rn-journey';
import { createOidcClient, createOidcWebClient, type OidcWebClient } from '@ping-identity/rn-oidc';
import { CacheStrategy, configureOidcStorage, type OidcStorage } from '@react-native-pingidentity/storage';
import { commonStyles } from '../src/styles/common';
import { pingAdvancedIdentityCloudConfig } from '../src/clients';
import MessageBlock from './components/MessageBlock';
import { colors } from '../src/styles/colors';

/**
 * Renders session logout controls for Journey and OIDC sessions.
 *
 * @returns Logout screen element.
 */
export default function LogoutScreen(): React.ReactElement {
  const [busyAll, setBusyAll] = useState<boolean>(false);
  const [busyJourney, setBusyJourney] = useState<boolean>(false);
  const [busyOidc, setBusyOidc] = useState<boolean>(false);
  const [journeyActive, setJourneyActive] = useState<boolean>(false);
  const [oidcActive, setOidcActive] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const oidcStorageRef = useRef<OidcStorage | null>(null);
  const oidcWebClientRef = useRef<OidcWebClient | null>(null);
  const [, journeyActions] = useJourney();

  const getOidcWebClient = useCallback((): OidcWebClient => {
    if (oidcWebClientRef.current) {
      return oidcWebClientRef.current;
    }

    const storage =
      oidcStorageRef.current ??
      configureOidcStorage({
        android: {
          fileName: 'ping-oidc',
          keyAlias: 'ping-oidc',
          strongBoxPreferred: true,
          cacheStrategy: CacheStrategy.CACHE_ON_FAILURE,
        },
        ios: {
          account: 'com.pingidentity.rnsampleapp.oidc',
          encryptor: true,
          cacheable: true,
        },
      });
    oidcStorageRef.current = storage;

    const oidcClient = createOidcClient({
      clientId: pingAdvancedIdentityCloudConfig.clientId,
      discoveryEndpoint: pingAdvancedIdentityCloudConfig.discoveryEndpoint,
      redirectUri: pingAdvancedIdentityCloudConfig.redirectUri,
      scopes: [...pingAdvancedIdentityCloudConfig.scopes],
      signOutRedirectUri: `${pingAdvancedIdentityCloudConfig.redirectUri}/logout`,
      storage,
      ios: {
        browserType: 'ephemeralAuthSession',
        browserMode: 'login',
      },
    });

    const webClient = createOidcWebClient(oidcClient);
    oidcWebClientRef.current = webClient;
    return webClient;
  }, []);

  const refreshSessionState = useCallback(async (): Promise<void> => {
    try {
      const journeySession = await journeyActions.user();
      setJourneyActive(Boolean(journeySession));
    } catch {
      setJourneyActive(false);
    }

    try {
      const webClient = getOidcWebClient();
      const oidcUser = await webClient.user();
      setOidcActive(Boolean(oidcUser));
    } catch {
      setOidcActive(false);
    }
  }, [getOidcWebClient, journeyActions]);

  useFocusEffect(
    useCallback(() => {
      refreshSessionState().catch(() => undefined);
      return undefined;
    }, [refreshSessionState])
  );

  const handleLogoutAll = useCallback(async (): Promise<void> => {
    setBusyAll(true);
    setErrorMessage(null);
    setStatusMessage(null);
    const errors: string[] = [];

    try {
      await journeyActions.logoutUser();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Journey logout failed');
    }

    try {
      const webClient = getOidcWebClient();
      const user = await webClient.user();
      if (user) {
        await user.logout();
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'OIDC logout failed');
    }

    await refreshSessionState();
    setBusyAll(false);

    if (errors.length > 0) {
      setErrorMessage(errors.join('\n'));
      return;
    }
  }, [getOidcWebClient, journeyActions, refreshSessionState]);

  const handleLogoutOidc = useCallback(async (): Promise<void> => {
    setBusyOidc(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const webClient = getOidcWebClient();
      const user = await webClient.user();
      if (!user) {
        setStatusMessage('No active OIDC Web session found.');
        return;
      }
      await user.logout();
      setStatusMessage('OIDC Web session logged out.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'OIDC Web logout failed');
    } finally {
      setBusyOidc(false);
      await refreshSessionState();
    }
  }, [getOidcWebClient, refreshSessionState]);

  const handleLogoutJourney = useCallback(async (): Promise<void> => {
    setBusyJourney(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await journeyActions.logoutUser();
      setStatusMessage('Journey session logged out.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Journey logout failed');
    } finally {
      setBusyJourney(false);
      await refreshSessionState();
    }
  }, [journeyActions, refreshSessionState]);

  const disabled = busyAll || busyJourney || busyOidc;
  const hasAnySession = journeyActive || oidcActive;

  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.codeTitle}>Active Sessions</Text>
        <Text style={commonStyles.codeText}>Select a session to logout</Text>

        {hasAnySession ? (
          <TouchableOpacity
            style={[
              commonStyles.buttonPrimary,
              disabled ? commonStyles.homeRowDisabled : null,
            ]}
            disabled={disabled}
            onPress={() => {
              handleLogoutAll().catch(() => undefined);
            }}
          >
            {busyAll ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={commonStyles.buttonText}>Logout All Sessions</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={[commonStyles.buttonSecondary, commonStyles.homeRowDisabled]}>
            <Text style={commonStyles.buttonTextSecondary}>No Active Sessions</Text>
          </View>
        )}
      </View>

      {journeyActive ? (
        <View style={commonStyles.card}>
          <Text style={commonStyles.codeTitle}>Journey Session</Text>
          <Text style={commonStyles.codeText}>Logout from Journey authentication</Text>
          <Text style={commonStyles.codeText}>Status: Active</Text>
          <TouchableOpacity
            style={[
              commonStyles.buttonPrimary,
              disabled ? commonStyles.homeRowDisabled : null,
            ]}
            disabled={disabled}
            onPress={() => {
              handleLogoutJourney().catch(() => undefined);
            }}
          >
            {busyJourney ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={commonStyles.buttonText}>Logout from Journey Session</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {oidcActive ? (
        <View style={commonStyles.card}>
          <Text style={commonStyles.codeTitle}>OIDC Web Session</Text>
          <Text style={commonStyles.codeText}>Logout from OIDC Web authentication</Text>
          <Text style={commonStyles.codeText}>Status: Active</Text>
          <TouchableOpacity
            style={[
              commonStyles.buttonPrimary,
              disabled ? commonStyles.homeRowDisabled : null,
            ]}
            disabled={disabled}
            onPress={() => {
              handleLogoutOidc().catch(() => undefined);
            }}
          >
            {busyOidc ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={commonStyles.buttonText}>Logout from OIDC Web Session</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {!hasAnySession ? (
        <MessageBlock
          title="No Active Sessions"
          message="You are not logged in to any session"
        />
      ) : null}
      {statusMessage ? (
        <Text style={commonStyles.textSuccess}>{statusMessage}</Text>
      ) : null}
      {errorMessage ? (
        <Text style={commonStyles.textError}>{errorMessage}</Text>
      ) : null}
    </ScrollView>
  );
}

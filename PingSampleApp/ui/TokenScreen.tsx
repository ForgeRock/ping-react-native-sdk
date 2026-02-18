/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useJourney } from '@ping-identity/rn-journey';
import { createOidcClient, createOidcWebClient, type OidcUser, type OidcWebClient } from '@ping-identity/rn-oidc';
import { CacheStrategy, configureOidcStorage, type OidcStorage } from '@react-native-pingidentity/storage';
import { commonStyles } from '../src/styles/common';
import { journeyOidcClient, pingAdvancedIdentityCloudConfig } from '../src/clients';

type TokenTab = 'Journey' | 'DaVinci' | 'OIDC';

const getEmptyMessage = (tab: TokenTab): string => {
  switch (tab) {
    case 'Journey':
      return 'No Journey token information is available';
    case 'OIDC':
      return 'No OIDC token information is available';
    default:
      return 'No DaVinci token information is available';
  }
};

/**
 * Renders token operations by auth source with tabbed navigation.
 *
 * @returns Token screen element.
 */
export default function TokenScreen(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TokenTab>('Journey');
  const [tokenOutput, setTokenOutput] = useState<string>(getEmptyMessage('Journey'));
  const [loading, setLoading] = useState<boolean>(false);

  const oidcStorageRef = useRef<OidcStorage | null>(null);
  const journeyOidcWebClientRef = useRef<OidcWebClient | null>(null);
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

  const getOidcUser = useCallback(async (): Promise<OidcUser | null> => {
    const webClient = getOidcWebClient();
    return await webClient.user();
  }, [getOidcWebClient]);

  const getJourneyOidcWebClient = useCallback((): OidcWebClient => {
    if (journeyOidcWebClientRef.current) {
      return journeyOidcWebClientRef.current;
    }
    const webClient = createOidcWebClient(journeyOidcClient);
    journeyOidcWebClientRef.current = webClient;
    return webClient;
  }, []);

  const getJourneyOidcUser = useCallback(async (): Promise<OidcUser | null> => {
    const webClient = getJourneyOidcWebClient();
    return await webClient.user();
  }, [getJourneyOidcWebClient]);

  const handleAccessToken = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      if (activeTab === 'Journey') {
        const session = await journeyActions.user();
        if (!session) {
          setTokenOutput(getEmptyMessage('Journey'));
          return;
        }
        setTokenOutput(JSON.stringify(session, null, 2));
        return;
      }

      if (activeTab === 'OIDC') {
        const user = await getOidcUser();
        if (!user) {
          setTokenOutput(getEmptyMessage('OIDC'));
          return;
        }
        const tokens = await user.token();
        setTokenOutput(JSON.stringify(tokens, null, 2));
        return;
      }

      setTokenOutput(getEmptyMessage('DaVinci'));
    } catch (error) {
      setTokenOutput(error instanceof Error ? error.message : 'Token retrieval failed');
    } finally {
      setLoading(false);
    }
  }, [activeTab, getOidcUser, journeyActions]);

  const handleRefresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      if (activeTab === 'OIDC') {
        const user = await getOidcUser();
        if (!user) {
          setTokenOutput(getEmptyMessage('OIDC'));
          return;
        }
        const refreshed = await user.refresh();
        setTokenOutput(JSON.stringify(refreshed, null, 2));
        return;
      }

      if (activeTab === 'Journey') {
        const session = await journeyActions.user();
        if (!session) {
          setTokenOutput(getEmptyMessage('Journey'));
          return;
        }

        const journeyOidcUser = await getJourneyOidcUser();
        if (!journeyOidcUser) {
          setTokenOutput(
            'Journey token refresh is unavailable. Ensure Journey is composed with OIDC and authenticated.'
          );
          return;
        }

        const refreshed = await journeyOidcUser.refresh();
        setTokenOutput(JSON.stringify(refreshed, null, 2));
        return;
      }

      setTokenOutput(getEmptyMessage('DaVinci'));
    } catch (error) {
      setTokenOutput(error instanceof Error ? error.message : 'Token refresh failed');
    } finally {
      setLoading(false);
    }
  }, [activeTab, getJourneyOidcUser, getOidcUser, journeyActions]);

  const handleRevoke = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      if (activeTab === 'OIDC') {
        const user = await getOidcUser();
        if (!user) {
          setTokenOutput(getEmptyMessage('OIDC'));
          return;
        }
        await user.revoke();
        setTokenOutput('OIDC token revoked.');
        return;
      }

      if (activeTab === 'Journey') {
        const session = await journeyActions.user();
        if (!session) {
          setTokenOutput(getEmptyMessage('Journey'));
          return;
        }

        const journeyOidcUser = await getJourneyOidcUser();
        if (!journeyOidcUser) {
          setTokenOutput(
            'Journey token revoke is unavailable. Ensure Journey is composed with OIDC and authenticated.'
          );
          return;
        }

        await journeyOidcUser.revoke();
        setTokenOutput('Journey token revoked.');
        return;
      }

      setTokenOutput(getEmptyMessage('DaVinci'));
    } catch (error) {
      setTokenOutput(error instanceof Error ? error.message : 'Token revoke failed');
    } finally {
      setLoading(false);
    }
  }, [activeTab, getJourneyOidcUser, getOidcUser, journeyActions]);

  const handleClear = useCallback((): void => {
    setTokenOutput(getEmptyMessage(activeTab));
  }, [activeTab]);
  const isDaVinciTab = activeTab === 'DaVinci';

  useFocusEffect(
    useCallback(() => {
      handleAccessToken().catch(() => undefined);
      return undefined;
    }, [handleAccessToken])
  );

  return (
    <View style={commonStyles.userProfileContainer}>
      <View style={commonStyles.userProfileTabs}>
        {(['Journey', 'DaVinci', 'OIDC'] as const).map(tab => {
          const selected = tab === activeTab;
          return (
            <TouchableOpacity
              key={tab}
              style={[commonStyles.userProfileTab, selected ? commonStyles.userProfileTabActive : null]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  commonStyles.userProfileTabText,
                  selected ? commonStyles.userProfileTabTextActive : null,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={commonStyles.userProfileBody}
        contentContainerStyle={commonStyles.container}
      >
        <View style={commonStyles.card}>
          {isDaVinciTab ? (
            <View style={commonStyles.homeRowTitleContainer}>
              <Text style={commonStyles.codeTitle}>Token Output</Text>
              <View style={commonStyles.homeComingSoonBadge}>
                <Text style={commonStyles.homeComingSoonText}>COMING SOON</Text>
              </View>
            </View>
          ) : (
            <Text style={commonStyles.codeTitle}>Token Output</Text>
          )}
          <View style={commonStyles.payloadScrollContainer}>
            <ScrollView
              style={commonStyles.payloadScroll}
              contentContainerStyle={commonStyles.payloadScrollContent}
              nestedScrollEnabled
            >
              <Text style={commonStyles.codeText}>{tokenOutput}</Text>
            </ScrollView>
          </View>
        </View>

        {!isDaVinciTab ? (
          <View style={commonStyles.card}>
            <View style={commonStyles.buttonGrid}>
              <TouchableOpacity
                style={[
                  commonStyles.buttonPrimary,
                  commonStyles.buttonGridItem,
                  loading ? commonStyles.homeRowDisabled : null,
                ]}
                disabled={loading}
                onPress={() => {
                  handleAccessToken().catch(() => undefined);
                }}
              >
                <Text style={commonStyles.buttonText}>AccessToken</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  commonStyles.buttonSecondary,
                  commonStyles.buttonGridItem,
                  loading ? commonStyles.homeRowDisabled : null,
                ]}
                disabled={loading}
                onPress={handleClear}
              >
                <Text style={commonStyles.buttonTextSecondary}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  commonStyles.buttonPrimary,
                  commonStyles.buttonGridItem,
                  loading ? commonStyles.homeRowDisabled : null,
                ]}
                disabled={loading}
                onPress={() => {
                  handleRefresh().catch(() => undefined);
                }}
              >
                <Text style={commonStyles.buttonText}>Refresh</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  commonStyles.buttonPrimary,
                  commonStyles.buttonGridItem,
                  loading ? commonStyles.homeRowDisabled : null,
                ]}
                disabled={loading}
                onPress={() => {
                  handleRevoke().catch(() => undefined);
                }}
              >
                <Text style={commonStyles.buttonText}>Revoke</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          null
        )}
      </ScrollView>
    </View>
  );
}

/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useJourney, type JourneyUserSession } from '@ping-identity/rn-journey';
import { createOidcClient, createOidcWebClient, type OidcWebClient } from '@ping-identity/rn-oidc';
import { CacheStrategy, configureOidcStorage, type OidcStorage } from '@react-native-pingidentity/storage';
import { commonStyles } from '../src/styles/common';
import { journeyOidcClient, pingAdvancedIdentityCloudConfig } from '../src/clients';
import { RootStackParamList } from '../App';
import AuthSourceTabs from './components/molecules/AuthSourceTabs';
import UserProfileDaVinciPanel from './userProfile/components/organisms/UserProfileDaVinciPanel';
import UserProfileJourneyPanel from './userProfile/components/organisms/UserProfileJourneyPanel';
import UserProfileOidcPanel from './userProfile/components/organisms/UserProfileOidcPanel';

type UserProfileTab = 'Journey' | 'DaVinci' | 'OIDC';
const USER_PROFILE_TABS = ['Journey', 'DaVinci', 'OIDC'] as const;

type OidcSessionData = {
  tokens: Record<string, unknown> | null;
  userInfo: Record<string, unknown> | null;
};

type UserProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'UserProfile'>;

type Props = {
  navigation: UserProfileNavigationProp;
};

/**
 * User profile demo screen showing session state by authentication source.
 *
 * @param props Screen props.
 * @param props.navigation Stack navigation controller.
 * @returns User profile screen element.
 */
export default function UserProfileScreen({ navigation }: Props): React.ReactElement {
  const [activeTab, setActiveTab] = useState<UserProfileTab>('Journey');
  const [journeySession, setJourneySession] = useState<JourneyUserSession | null>(null);
  const [journeyLoading, setJourneyLoading] = useState<boolean>(false);
  const [journeyError, setJourneyError] = useState<string | null>(null);

  const [oidcSession, setOidcSession] = useState<OidcSessionData | null>(null);
  const [oidcLoading, setOidcLoading] = useState<boolean>(false);
  const [oidcError, setOidcError] = useState<string | null>(null);
  const [showRawJourneyUserInfo, setShowRawJourneyUserInfo] = useState<boolean>(false);
  const [showRawOidcUserInfo, setShowRawOidcUserInfo] = useState<boolean>(false);

  const oidcStorageRef = useRef<OidcStorage | null>(null);
  const oidcWebClientRef = useRef<OidcWebClient | null>(null);
  const journeyOidcWebClientRef = useRef<OidcWebClient | null>(null);

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

  const getJourneyOidcWebClient = useCallback((): OidcWebClient => {
    if (journeyOidcWebClientRef.current) {
      return journeyOidcWebClientRef.current;
    }
    const webClient = createOidcWebClient(journeyOidcClient);
    journeyOidcWebClientRef.current = webClient;
    return webClient;
  }, []);

  const refreshJourneySession = useCallback(async (): Promise<void> => {
    setJourneyLoading(true);
    setJourneyError(null);
    setShowRawJourneyUserInfo(false);
    let journeySessionError: string | null = null;
    try {
      let session: JourneyUserSession | null = null;
      try {
        session = await journeyActions.user();
      } catch (error) {
        journeySessionError =
          error instanceof Error ? error.message : 'Unable to resolve Journey session.';
      }

      if (session) {
        setJourneySession(session);
        return;
      }

      const journeyOidcUser = await getJourneyOidcWebClient().user();
      if (!journeyOidcUser) {
        setJourneySession(null);
        return;
      }

      const token = await journeyOidcUser.token();
      const userInfo = await journeyOidcUser.userinfo(true);
      setJourneySession({
        accessToken: token.accessToken,
        ...(token.refreshToken ? { refreshToken: token.refreshToken } : {}),
        ...(userInfo ? { userInfo: userInfo as Record<string, unknown> } : {}),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to resolve Journey session.';
      setJourneyError(journeySessionError ?? message);
      setJourneySession(null);
    } finally {
      setJourneyLoading(false);
    }
  }, [getJourneyOidcWebClient, journeyActions]);

  const refreshOidcSession = useCallback(async (): Promise<void> => {
    setOidcLoading(true);
    setOidcError(null);
    setShowRawOidcUserInfo(false);
    try {
      const webClient = getOidcWebClient();
      const user = await webClient.user();
      if (!user) {
        setOidcSession(null);
        return;
      }

      const tokens = await user.token();
      const userInfo = await user.userinfo(true);
      setOidcSession({
        tokens: tokens as Record<string, unknown>,
        userInfo: userInfo as Record<string, unknown>,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to resolve OIDC session.';
      setOidcError(message);
      setOidcSession(null);
    } finally {
      setOidcLoading(false);
    }
  }, [getOidcWebClient]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'Journey') {
        refreshJourneySession().catch(() => undefined);
      } else if (activeTab === 'OIDC') {
        refreshOidcSession().catch(() => undefined);
      }
      return undefined;
    }, [activeTab, refreshJourneySession, refreshOidcSession])
  );

  /**
   * Handles auth source tab change and clears source-specific raw toggles.
   *
   * @param tab Newly selected auth source tab.
   * @returns Void.
   */
  const handleTabChange = useCallback((tab: UserProfileTab): void => {
    setActiveTab(tab);
    if (tab !== 'Journey') {
      setShowRawJourneyUserInfo(false);
    }
    if (tab !== 'OIDC') {
      setShowRawOidcUserInfo(false);
    }
  }, []);

  return (
    <View style={commonStyles.userProfileContainer}>
      <AuthSourceTabs
        tabs={USER_PROFILE_TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      <ScrollView
        style={commonStyles.userProfileBody}
        contentContainerStyle={commonStyles.userProfileBodyContent}
      >
        {activeTab === 'Journey' ? (
          <UserProfileJourneyPanel
            loading={journeyLoading}
            session={journeySession}
            error={journeyError}
            showRawUserInfo={showRawJourneyUserInfo}
            onToggleRawUserInfo={() => setShowRawJourneyUserInfo((value) => !value)}
            onStartJourney={() => navigation.navigate('JourneyRoute')}
          />
        ) : null}

        {activeTab === 'DaVinci' ? <UserProfileDaVinciPanel /> : null}

        {activeTab === 'OIDC' ? (
          <UserProfileOidcPanel
            loading={oidcLoading}
            userInfo={oidcSession?.userInfo ?? null}
            hasSession={Boolean(oidcSession)}
            error={oidcError}
            showRawUserInfo={showRawOidcUserInfo}
            onToggleRawUserInfo={() => setShowRawOidcUserInfo((value) => !value)}
            onStartOidc={() => navigation.navigate('Oidc')}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

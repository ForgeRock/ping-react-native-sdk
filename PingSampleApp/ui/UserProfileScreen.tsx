/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useJourney, type JourneyUserSession } from '@ping-identity/rn-journey';
import { createOidcClient, createOidcWebClient, type OidcWebClient } from '@ping-identity/rn-oidc';
import { CacheStrategy, configureOidcStorage, type OidcStorage } from '@react-native-pingidentity/storage';
import { commonStyles } from '../src/styles/common';
import { pingAdvancedIdentityCloudConfig } from '../src/clients';
import { RootStackParamList } from '../App';
import { colors } from '../src/styles/colors';

type UserProfileTab = 'Journey' | 'DaVinci' | 'OIDC';

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

  const refreshJourneySession = useCallback(async (): Promise<void> => {
    setJourneyLoading(true);
    setJourneyError(null);
    setShowRawJourneyUserInfo(false);
    try {
      const session = await journeyActions.user();
      setJourneySession(session);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to resolve Journey session.';
      setJourneyError(message);
      setJourneySession(null);
    } finally {
      setJourneyLoading(false);
    }
  }, [journeyActions]);

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

  const renderJsonBlock = (title: string, payload: Record<string, unknown> | null) => {
    if (!payload) {
      return (
        <View style={commonStyles.userProfileSection}>
          <Text style={commonStyles.userProfileSectionTitle}>{title}</Text>
          <Text style={commonStyles.userProfileSubText}>No data available.</Text>
        </View>
      );
    }
    return (
      <View style={commonStyles.userProfileSection}>
        <Text style={commonStyles.userProfileSectionTitle}>{title}</Text>
        <View style={commonStyles.payloadScrollContainer}>
          <ScrollView
            style={commonStyles.payloadScroll}
            contentContainerStyle={commonStyles.payloadScrollContent}
            nestedScrollEnabled
          >
            <Text style={commonStyles.userProfileCode}>{JSON.stringify(payload, null, 2)}</Text>
          </ScrollView>
        </View>
      </View>
    );
  };

  const asDisplayValue = (value: unknown): string | null => {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return null;
  };

  const readProfileField = (
    payload: Record<string, unknown> | null,
    keys: readonly string[]
  ): string => {
    if (!payload) {
      return 'Not available';
    }
    for (const key of keys) {
      const value = asDisplayValue(payload[key]);
      if (value) {
        return value;
      }
    }
    return 'Not available';
  };

  const wrapProfileValue = (value: string): string => {
    return value === 'Not available' ? value : `"${value}"`;
  };

  const renderJourneyTab = () => {
    if (journeyLoading) {
      return (
        <View style={commonStyles.userProfileLoadingCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={commonStyles.userProfileSubText}>Checking Journey session...</Text>
        </View>
      );
    }

    if (!journeySession) {
      return (
        <View style={commonStyles.userProfileEmptyCard}>
          <Text style={commonStyles.userProfileEmptyTitle}>No Journey User</Text>
          <Text style={commonStyles.userProfileSubText}>
            Please authenticate using Journey to view user profile information.
          </Text>
          <TouchableOpacity
            style={commonStyles.buttonPrimary}
            onPress={() => navigation.navigate('JourneyRoute')}
          >
            <Text style={commonStyles.buttonText}>Start Journey</Text>
          </TouchableOpacity>
          {journeyError ? (
            <Text style={commonStyles.userProfileErrorText}>{journeyError}</Text>
          ) : null}
        </View>
      );
    }

    const userInfo = (journeySession.userInfo ?? null) as Record<string, unknown> | null;
    const firstName = wrapProfileValue(
      readProfileField(userInfo, ['given_name', 'firstName', 'first_name'])
    );
    const familyName = wrapProfileValue(
      readProfileField(userInfo, ['family_name', 'lastName', 'last_name'])
    );
    const email = wrapProfileValue(readProfileField(userInfo, ['email']));

    return (
      <View style={commonStyles.userProfileCard}>
        <Text style={commonStyles.userProfileSectionTitle}>Journey User Info</Text>
        <Text style={commonStyles.userProfileInfoLine}>First name: {firstName}</Text>
        <Text style={commonStyles.userProfileInfoLine}>Family name: {familyName}</Text>
        <Text style={commonStyles.userProfileInfoLine}>Email: {email}</Text>

        <TouchableOpacity
          style={commonStyles.buttonPrimary}
          onPress={() => setShowRawJourneyUserInfo((value) => !value)}
        >
          <Text style={commonStyles.buttonText}>
            {showRawJourneyUserInfo ? 'Hide Raw User Info' : 'Show Raw User Info'}
          </Text>
        </TouchableOpacity>

        {showRawJourneyUserInfo ? renderJsonBlock('Raw User Info', userInfo) : null}
      </View>
    );
  };

  const renderDaVinciTab = () => {
    return (
      <View style={commonStyles.userProfileEmptyCard}>
        <Text style={commonStyles.userProfileEmptyTitle}>DaVinci Session</Text>
        <Text style={commonStyles.userProfileSubText}>
          DaVinci user profile integration is not available in this sample yet.
        </Text>
      </View>
    );
  };

  const renderOidcTab = () => {
    if (oidcLoading) {
      return (
        <View style={commonStyles.userProfileLoadingCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={commonStyles.userProfileSubText}>Checking OIDC session...</Text>
        </View>
      );
    }

    if (!oidcSession) {
      return (
        <View style={commonStyles.userProfileEmptyCard}>
          <Text style={commonStyles.userProfileEmptyTitle}>No OIDC User</Text>
          <Text style={commonStyles.userProfileSubText}>
            Please authenticate using OIDC to view user profile information.
          </Text>
          <TouchableOpacity
            style={commonStyles.buttonPrimary}
            onPress={() => navigation.navigate('Oidc')}
          >
            <Text style={commonStyles.buttonText}>Start OIDC</Text>
          </TouchableOpacity>
          {oidcError ? (
            <Text style={commonStyles.userProfileErrorText}>{oidcError}</Text>
          ) : null}
        </View>
      );
    }

    const userInfo = oidcSession.userInfo;
    const firstName = wrapProfileValue(
      readProfileField(userInfo, ['given_name', 'firstName', 'first_name'])
    );
    const familyName = wrapProfileValue(
      readProfileField(userInfo, ['family_name', 'lastName', 'last_name'])
    );
    const email = wrapProfileValue(readProfileField(userInfo, ['email']));

    return (
      <View style={commonStyles.userProfileCard}>
        <Text style={commonStyles.userProfileSectionTitle}>OIDC User Info</Text>
        <Text style={commonStyles.userProfileInfoLine}>First name: {firstName}</Text>
        <Text style={commonStyles.userProfileInfoLine}>Family name: {familyName}</Text>
        <Text style={commonStyles.userProfileInfoLine}>Email: {email}</Text>

        <TouchableOpacity
          style={commonStyles.buttonPrimary}
          onPress={() => setShowRawOidcUserInfo((value) => !value)}
        >
          <Text style={commonStyles.buttonText}>
            {showRawOidcUserInfo ? 'Hide Raw User Info' : 'Show Raw User Info'}
          </Text>
        </TouchableOpacity>

        {showRawOidcUserInfo ? renderJsonBlock('Raw User Info', oidcSession.userInfo) : null}
      </View>
    );
  };

  return (
    <View style={commonStyles.userProfileContainer}>
      <View style={commonStyles.userProfileTabs}>
        {(['Journey', 'DaVinci', 'OIDC'] as const).map(tab => {
          const selected = tab === activeTab;
          return (
            <TouchableOpacity
              key={tab}
              style={[commonStyles.userProfileTab, selected ? commonStyles.userProfileTabActive : null]}
              onPress={() => {
                setActiveTab(tab);
                if (tab !== 'Journey') {
                  setShowRawJourneyUserInfo(false);
                }
                if (tab !== 'OIDC') {
                  setShowRawOidcUserInfo(false);
                }
              }}
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
        contentContainerStyle={commonStyles.userProfileBodyContent}
      >
        {activeTab === 'Journey' ? renderJourneyTab() : null}
        {activeTab === 'DaVinci' ? renderDaVinciTab() : null}
        {activeTab === 'OIDC' ? renderOidcTab() : null}
      </ScrollView>
    </View>
  );
}

/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useJourney, type JourneyUserSession } from '@ping-identity/rn-journey';
import { useOidc } from '@ping-identity/rn-oidc';
import { useDaVinci } from '@ping-identity/rn-davinci';
import { formatError } from './utils/formatError';
import { commonStyles } from '../src/styles/common';
import { RootStackParamList } from '../App';
import AuthSourceTabs from './components/molecules/AuthSourceTabs';
import UserProfileJourneyPanel from './userProfile/components/organisms/UserProfileJourneyPanel';
import UserProfileOidcPanel from './userProfile/components/organisms/UserProfileOidcPanel';
import UserProfileDaVinciPanel from './userProfile/components/organisms/UserProfileDaVinciPanel';

type UserProfileTab = 'Journey' | 'OIDC' | 'DaVinci';
const USER_PROFILE_TABS = ['Journey', 'OIDC', 'DaVinci'] as const;

type UserProfileNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'UserProfile'
>;

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
export default function UserProfileScreen({
  navigation,
}: Props): React.ReactElement {
  const [activeTab, setActiveTab] = useState<UserProfileTab>('Journey');
  const [journeySession, setJourneySession] =
    useState<JourneyUserSession | null>(null);
  const [journeyLoading, setJourneyLoading] = useState<boolean>(false);
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [showRawJourneyUserInfo, setShowRawJourneyUserInfo] =
    useState<boolean>(false);
  const [showRawOidcUserInfo, setShowRawOidcUserInfo] =
    useState<boolean>(false);
  const [davinciUserInfo, setDavinciUserInfo] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [davinciHasSession, setDavinciHasSession] = useState<boolean>(false);
  const [davinciLoading, setDavinciLoading] = useState<boolean>(false);
  const [davinciError, setDavinciError] = useState<string | null>(null);
  const [showRawDavinciUserInfo, setShowRawDavinciUserInfo] =
    useState<boolean>(false);

  const [, journeyActions] = useJourney();
  const [oidcState, oidcActions] = useOidc();
  const davinciActions = useDaVinci();

  const refreshJourneySession = useCallback(async (): Promise<void> => {
    setJourneyLoading(true);
    setJourneyError(null);
    setShowRawJourneyUserInfo(false);
    try {
      const session = await journeyActions.user();
      if (session) {
        setJourneySession(session);
      } else {
        setJourneySession(null);
      }
    } catch (error) {
      setJourneyError(formatError(error));
      setJourneySession(null);
    } finally {
      setJourneyLoading(false);
    }
  }, [journeyActions]);

  const refreshOidcSession = useCallback(async (): Promise<void> => {
    setShowRawOidcUserInfo(false);
    try {
      const user = await oidcActions.restore();
      if (!user) {
        return;
      }
      await oidcActions.userinfo(true);
    } catch {
      // OIDC hook state already captures typed errors for UI display.
    }
  }, [oidcActions]);

  const refreshDavinciSession = useCallback(async (): Promise<void> => {
    setDavinciLoading(true);
    setDavinciError(null);
    setShowRawDavinciUserInfo(false);
    try {
      const session = await davinciActions.user();
      if (!session) {
        setDavinciHasSession(false);
        setDavinciUserInfo(null);
        return;
      }
      setDavinciHasSession(true);
      const info = await davinciActions.userinfo();
      setDavinciUserInfo(info);
    } catch (error) {
      setDavinciError(formatError(error));
      setDavinciHasSession(false);
      setDavinciUserInfo(null);
    } finally {
      setDavinciLoading(false);
    }
  }, [davinciActions]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'Journey') {
        void refreshJourneySession();
      } else if (activeTab === 'OIDC') {
        void refreshOidcSession();
      } else if (activeTab === 'DaVinci') {
        void refreshDavinciSession();
      }
      return undefined;
    }, [
      activeTab,
      refreshJourneySession,
      refreshOidcSession,
      refreshDavinciSession,
    ]),
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
    if (tab !== 'DaVinci') {
      setShowRawDavinciUserInfo(false);
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
        nestedScrollEnabled
      >
        {activeTab === 'Journey' ? (
          <UserProfileJourneyPanel
            loading={journeyLoading}
            session={journeySession}
            error={journeyError}
            showRawUserInfo={showRawJourneyUserInfo}
            onToggleRawUserInfo={() =>
              setShowRawJourneyUserInfo(value => !value)
            }
            onStartJourney={() => navigation.navigate('JourneyRoute')}
          />
        ) : null}

        {activeTab === 'OIDC' ? (
          <UserProfileOidcPanel
            loading={oidcState.isLoading}
            userInfo={oidcState.userInfo ?? null}
            hasSession={oidcState.isAuthenticated}
            error={oidcState.error?.message ?? null}
            showRawUserInfo={showRawOidcUserInfo}
            onToggleRawUserInfo={() => setShowRawOidcUserInfo(value => !value)}
            onStartOidc={async () => {
              try {
                await oidcActions.authorize();
                await oidcActions.userinfo(true);
              } catch (cause) {
                Alert.alert('OIDC start failed', formatError(cause));
              }
            }}
          />
        ) : null}

        {activeTab === 'DaVinci' ? (
          <UserProfileDaVinciPanel
            loading={davinciLoading}
            userInfo={davinciUserInfo}
            hasSession={davinciHasSession}
            error={davinciError}
            showRawUserInfo={showRawDavinciUserInfo}
            onToggleRawUserInfo={() =>
              setShowRawDavinciUserInfo(value => !value)
            }
            onStartDaVinci={() => navigation.navigate('DaVinci')}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

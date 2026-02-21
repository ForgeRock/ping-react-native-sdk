/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useJourney, type JourneyUserSession } from '@ping-identity/rn-journey';
import { useOidc } from '@ping-identity/rn-oidc';
import { commonStyles } from '../src/styles/common';
import { RootStackParamList } from '../App';
import AuthSourceTabs from './components/molecules/AuthSourceTabs';
import UserProfileJourneyPanel from './userProfile/components/organisms/UserProfileJourneyPanel';
import UserProfileOidcPanel from './userProfile/components/organisms/UserProfileOidcPanel';

type UserProfileTab = 'Journey' | 'OIDC';
const USER_PROFILE_TABS = ['Journey', 'OIDC'] as const;

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
  const [showRawJourneyUserInfo, setShowRawJourneyUserInfo] = useState<boolean>(false);
  const [showRawOidcUserInfo, setShowRawOidcUserInfo] = useState<boolean>(false);

  const [, journeyActions] = useJourney();
  const [oidcState, oidcActions] = useOidc();

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
      const message =
        error instanceof Error ? error.message : 'Unable to resolve Journey session.';
      setJourneyError(message);
      setJourneySession(null);
    } finally {
      setJourneyLoading(false);
    }
  }, [journeyActions]);

  const refreshOidcSession = useCallback(async (): Promise<void> => {
    setShowRawOidcUserInfo(false);
    const user = await oidcActions.restore();
    if (!user) {
      return;
    }
    await oidcActions.userinfo(true);
  }, [oidcActions]);

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
        nestedScrollEnabled
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

        {activeTab === 'OIDC' ? (
          <UserProfileOidcPanel
            loading={oidcState.isLoading}
            userInfo={oidcState.userInfo ?? null}
            hasSession={oidcState.isAuthenticated}
            error={oidcState.error?.message ?? null}
            showRawUserInfo={showRawOidcUserInfo}
            onToggleRawUserInfo={() => setShowRawOidcUserInfo((value) => !value)}
            onStartOidc={() => {
              oidcActions.authorize().catch(() => undefined);
            }}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

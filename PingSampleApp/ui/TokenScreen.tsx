/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useJourney } from '@ping-identity/rn-journey';
import { commonStyles } from '../src/styles/common';
import AuthSourceTabs from './components/molecules/AuthSourceTabs';
import TokenDaVinciPanel from './token/components/organisms/TokenDaVinciPanel';
import TokenJourneyPanel from './token/components/organisms/TokenJourneyPanel';

const TOKEN_TABS = ['Journey', 'DaVinci'] as const;

type TokenTab = (typeof TOKEN_TABS)[number];

const getEmptyMessage = (tab: TokenTab): string => {
  switch (tab) {
    case 'Journey':
      return 'No Journey token information is available';
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

  const [, journeyActions] = useJourney();

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

      setTokenOutput(getEmptyMessage('DaVinci'));
    } catch (error) {
      setTokenOutput(error instanceof Error ? error.message : 'Token retrieval failed');
    } finally {
      setLoading(false);
    }
  }, [activeTab, journeyActions]);

  const handleClear = useCallback((): void => {
    setTokenOutput(getEmptyMessage(activeTab));
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      handleAccessToken().catch(() => undefined);
      return undefined;
    }, [handleAccessToken])
  );

  return (
    <View style={commonStyles.userProfileContainer}>
      <AuthSourceTabs tabs={TOKEN_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <ScrollView
        style={commonStyles.userProfileBody}
        contentContainerStyle={commonStyles.container}
      >
        {activeTab === 'Journey' ? (
          <TokenJourneyPanel
            tokenOutput={tokenOutput}
            loading={loading}
            onAccessToken={() => {
              handleAccessToken().catch(() => undefined);
            }}
            onClear={handleClear}
          />
        ) : (
          <TokenDaVinciPanel tokenOutput={tokenOutput} />
        )}
      </ScrollView>
    </View>
  );
}

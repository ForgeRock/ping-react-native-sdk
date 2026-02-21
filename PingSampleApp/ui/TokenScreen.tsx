/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
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

const JOURNEY_AUTH_REQUIRED_MESSAGE =
  'No authenticated Journey token state found. Complete Journey login first, then tap AccessToken.';

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
      if (
        error instanceof Error &&
        (error.message.includes('No AuthCode is available') ||
          error.message.includes('Please start Journey to authenticate'))
      ) {
        setTokenOutput(JOURNEY_AUTH_REQUIRED_MESSAGE);
      } else {
        setTokenOutput(error instanceof Error ? error.message : 'Token retrieval failed');
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, journeyActions]);

  const handleClear = useCallback((): void => {
    setTokenOutput(getEmptyMessage(activeTab));
  }, [activeTab]);

  const handleRefresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      if (activeTab === 'Journey') {
        const session = await journeyActions.refresh();
        if (!session) {
          setTokenOutput(getEmptyMessage('Journey'));
          return;
        }
        setTokenOutput(JSON.stringify(session, null, 2));
        return;
      }

      setTokenOutput(getEmptyMessage('DaVinci'));
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('No AuthCode is available') ||
          error.message.includes('Please start Journey to authenticate'))
      ) {
        setTokenOutput(JOURNEY_AUTH_REQUIRED_MESSAGE);
      } else {
        setTokenOutput(error instanceof Error ? error.message : 'Token refresh failed');
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, journeyActions]);

  const handleRevoke = useCallback(async (): Promise<void> => {
    if (activeTab !== 'Journey') {
      setTokenOutput(getEmptyMessage(activeTab));
      return;
    }

    setLoading(true);
    try {
      await journeyActions.revoke();
      const session = await journeyActions.user();
      if (session) {
        setTokenOutput(
          JSON.stringify(
            {
              note: 'Revoke completed, but Journey user session is still active.',
              session,
            },
            null,
            2
          )
        );
      } else {
        setTokenOutput(getEmptyMessage('Journey'));
      }
    } catch (error) {
      setTokenOutput(error instanceof Error ? error.message : 'Token revoke failed');
    } finally {
      setLoading(false);
    }
  }, [activeTab, journeyActions]);

  return (
    <View style={commonStyles.userProfileContainer}>
      <AuthSourceTabs tabs={TOKEN_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <ScrollView
        style={commonStyles.userProfileBody}
        contentContainerStyle={commonStyles.container}
        nestedScrollEnabled
      >
        {activeTab === 'Journey' ? (
          <TokenJourneyPanel
            tokenOutput={tokenOutput}
            loading={loading}
            onAccessToken={() => {
              handleAccessToken().catch(() => undefined);
            }}
            onRefresh={() => {
              handleRefresh().catch(() => undefined);
            }}
            onRevoke={() => {
              handleRevoke().catch(() => undefined);
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

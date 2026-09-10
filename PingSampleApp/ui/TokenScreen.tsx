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
import { useOidc } from '@ping-identity/rn-oidc';
import { useDaVinci } from '@ping-identity/rn-davinci';
import { useDeviceAuthGrant } from '@ping-identity/rn-oidc';
import { PingError } from '@ping-identity/rn-types';
import { formatError } from './utils/formatError';
import { commonStyles } from '../src/styles/common';
import AuthSourceTabs from './components/molecules/AuthSourceTabs';
import TokenJourneyPanel from './token/components/organisms/TokenJourneyPanel';
import TokenOidcPanel from './token/components/organisms/TokenOidcPanel';
import TokenDaVinciPanel from './token/components/organisms/TokenDaVinciPanel';
import TokenDeviceAuthPanel from './token/components/organisms/TokenDeviceAuthPanel';

const TOKEN_TABS = ['Journey', 'OIDC', 'DaVinci', 'Auth Grant'] as const;

type TokenTab = (typeof TOKEN_TABS)[number];

const getEmptyMessage = (tab: TokenTab): string => {
  switch (tab) {
    case 'Journey':
      return 'No Journey token information is available';
    case 'OIDC':
      return 'No OIDC token information is available';
    case 'DaVinci':
      return 'No DaVinci token information is available';
    case 'Auth Grant':
      return 'No Auth Grant token information is available';
  }
};

const JOURNEY_AUTH_REQUIRED_MESSAGE =
  'No authenticated Journey token state found. Complete Journey login first, then tap AccessToken.';

const DAVINCI_AUTH_REQUIRED_MESSAGE =
  'No authenticated DaVinci token state found. Complete DaVinci login first, then tap AccessToken.';

const authRequiredMessageFor = (tab: TokenTab): string =>
  tab === 'DaVinci'
    ? DAVINCI_AUTH_REQUIRED_MESSAGE
    : JOURNEY_AUTH_REQUIRED_MESSAGE;

/**
 * Renders token operations by auth source with tabbed navigation.
 *
 * @returns Token screen element.
 */
export default function TokenScreen(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TokenTab>('Journey');
  const [tokenOutputByTab, setTokenOutputByTab] = useState<
    Record<TokenTab, string>
  >({
    Journey: getEmptyMessage('Journey'),
    OIDC: getEmptyMessage('OIDC'),
    DaVinci: getEmptyMessage('DaVinci'),
    'Auth Grant': getEmptyMessage('Auth Grant'),
  });
  const [loading, setLoading] = useState<boolean>(false);

  const [, journeyActions] = useJourney();
  const [, oidcActions] = useOidc();
  const davinciActions = useDaVinci();
  const [, deviceActions] = useDeviceAuthGrant();

  const setActiveTabOutput = useCallback(
    (value: string): void => {
      setTokenOutputByTab(previous => ({ ...previous, [activeTab]: value }));
    },
    [activeTab],
  );

  const handleAccessToken = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      if (activeTab === 'Journey') {
        const session = await journeyActions.user();
        if (!session) {
          setActiveTabOutput(getEmptyMessage('Journey'));
          return;
        }
        setActiveTabOutput(JSON.stringify(session, null, 2));
        return;
      }

      if (activeTab === 'OIDC') {
        const tokens = await oidcActions.token();
        if (!tokens) {
          setActiveTabOutput(getEmptyMessage('OIDC'));
          return;
        }
        setActiveTabOutput(JSON.stringify(tokens, null, 2));
        return;
      }

      if (activeTab === 'DaVinci') {
        const session = await davinciActions.user();
        if (!session) {
          setActiveTabOutput(DAVINCI_AUTH_REQUIRED_MESSAGE);
          return;
        }
        setActiveTabOutput(session.accessToken);
        return;
      }

      const tokens = await deviceActions.token();
      setActiveTabOutput(
        tokens
          ? JSON.stringify(tokens, null, 2)
          : getEmptyMessage('Auth Grant'),
      );
    } catch (error) {
      if (
        error instanceof PingError &&
        (error.message.includes('No AuthCode is available') ||
          error.message.includes('Please start Journey to authenticate'))
      ) {
        setActiveTabOutput(authRequiredMessageFor(activeTab));
      } else {
        setActiveTabOutput(formatError(error));
      }
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    davinciActions,
    deviceActions,
    journeyActions,
    oidcActions,
    setActiveTabOutput,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'DaVinci') {
        void handleAccessToken();
      }
    }, [activeTab, handleAccessToken]),
  );

  const handleClear = useCallback((): void => {
    setActiveTabOutput(getEmptyMessage(activeTab));
  }, [activeTab, setActiveTabOutput]);

  const handleRefresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      if (activeTab === 'Journey') {
        const session = await journeyActions.refresh();
        if (!session) {
          setActiveTabOutput(getEmptyMessage('Journey'));
          return;
        }
        setActiveTabOutput(JSON.stringify(session, null, 2));
        return;
      }

      if (activeTab === 'OIDC') {
        const tokens = await oidcActions.refresh();
        if (!tokens) {
          setActiveTabOutput(getEmptyMessage('OIDC'));
          return;
        }
        setActiveTabOutput(JSON.stringify(tokens, null, 2));
        return;
      }

      if (activeTab === 'DaVinci') {
        const session = await davinciActions.refresh();
        if (!session) {
          setActiveTabOutput(DAVINCI_AUTH_REQUIRED_MESSAGE);
          return;
        }
        setActiveTabOutput(session.refreshToken ?? getEmptyMessage('DaVinci'));
        return;
      }

      const tokens = await deviceActions.refresh();
      setActiveTabOutput(
        tokens
          ? JSON.stringify(tokens, null, 2)
          : getEmptyMessage('Auth Grant'),
      );
    } catch (error) {
      if (
        error instanceof PingError &&
        (error.message.includes('No AuthCode is available') ||
          error.message.includes('Please start Journey to authenticate'))
      ) {
        setActiveTabOutput(authRequiredMessageFor(activeTab));
      } else {
        setActiveTabOutput(formatError(error));
      }
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    davinciActions,
    deviceActions,
    journeyActions,
    oidcActions,
    setActiveTabOutput,
  ]);

  const handleRevoke = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      if (activeTab === 'OIDC') {
        const revoked = await oidcActions.revoke();
        setActiveTabOutput(
          JSON.stringify(
            {
              revoked,
              note: revoked
                ? 'OIDC revoke completed. Re-authenticate to access tokens again.'
                : 'No active OIDC user to revoke.',
            },
            null,
            2,
          ),
        );
        return;
      }

      if (activeTab === 'DaVinci') {
        const revoked = await davinciActions.revoke();
        setActiveTabOutput(
          JSON.stringify(
            {
              revoked,
              note: revoked
                ? 'DaVinci revoke completed. Re-authenticate to access tokens again.'
                : 'No active DaVinci user to revoke.',
            },
            null,
            2,
          ),
        );
        return;
      }

      if (activeTab === 'Auth Grant') {
        await deviceActions.revoke();
        setActiveTabOutput(getEmptyMessage('Auth Grant'));
        return;
      }

      await journeyActions.revoke();
      const session = await journeyActions.user();
      if (session) {
        setActiveTabOutput(
          JSON.stringify(
            {
              note: 'Revoke completed, but Journey user session is still active.',
              session,
            },
            null,
            2,
          ),
        );
      } else {
        setActiveTabOutput(getEmptyMessage('Journey'));
      }
    } catch (error) {
      setActiveTabOutput(formatError(error));
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    davinciActions,
    deviceActions,
    journeyActions,
    oidcActions,
    setActiveTabOutput,
  ]);

  return (
    <View style={commonStyles.userProfileContainer}>
      <AuthSourceTabs
        tabs={TOKEN_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <ScrollView
        style={commonStyles.userProfileBody}
        contentContainerStyle={commonStyles.container}
        nestedScrollEnabled
      >
        {activeTab === 'Journey' ? (
          <TokenJourneyPanel
            tokenOutput={tokenOutputByTab.Journey}
            loading={loading}
            onAccessToken={() => {
              void handleAccessToken();
            }}
            onRefresh={() => {
              void handleRefresh();
            }}
            onRevoke={() => {
              void handleRevoke();
            }}
            onClear={handleClear}
          />
        ) : activeTab === 'OIDC' ? (
          <TokenOidcPanel
            tokenOutput={tokenOutputByTab.OIDC}
            loading={loading}
            onAccessToken={() => {
              void handleAccessToken();
            }}
            onRefresh={() => {
              void handleRefresh();
            }}
            onRevoke={() => {
              void handleRevoke();
            }}
            onClear={handleClear}
          />
        ) : activeTab === 'DaVinci' ? (
          <TokenDaVinciPanel
            tokenOutput={tokenOutputByTab.DaVinci}
            loading={loading}
            onAccessToken={() => {
              void handleAccessToken();
            }}
            onRefresh={() => {
              void handleRefresh();
            }}
            onRevoke={() => {
              void handleRevoke();
            }}
            onClear={handleClear}
          />
        ) : (
          <TokenDeviceAuthPanel
            tokenOutput={tokenOutputByTab['Auth Grant']}
            loading={loading}
            onAccessToken={() => {
              void handleAccessToken();
            }}
            onRefresh={() => {
              void handleRefresh();
            }}
            onRevoke={() => {
              void handleRevoke();
            }}
            onClear={handleClear}
          />
        )}
      </ScrollView>
    </View>
  );
}

/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import type { OidcClientConfig } from '@ping-identity/rn-oidc';
import { useOidc } from '@ping-identity/rn-oidc';
import { commonStyles } from '../../../../src/styles/common';
import CardSection from '../../../components/molecules/CardSection';
import AsyncActionButton from '../../../components/molecules/AsyncActionButton';
import PayloadViewer from '../../../components/atoms/PayloadViewer';
import KeyValueList, { type KeyValueItem } from '../../../components/atoms/KeyValueList';
import OidcActionsCard from '../molecules/OidcActionsCard';

/**
 * Props for OIDC client panel.
 */
type OidcClientPanelProps = {
  /**
   * OIDC client configuration used for the panel.
   */
  clientConfig: OidcClientConfig;
};

/**
 * Renders OIDC sample operations using the shared OIDC provider state.
 *
 * @param props Panel props.
 * @returns OIDC panel element.
 */
export default function OidcClientPanel(props: OidcClientPanelProps): React.ReactElement {
  const { clientConfig } = props;
  const [state, actions] = useOidc();

  const [showRawUserInfo, setShowRawUserInfo] = useState<boolean>(false);

  const handleAuthorize = (): void => {
    actions
      .authorize()
      .then(() => undefined)
      .catch(() => undefined);
  };

  const handleRestore = (): void => {
    actions
      .restore()
      .then(() => undefined)
      .catch(() => undefined);
  };

  const handleToken = (): void => {
    actions
      .token()
      .then(() => undefined)
      .catch(() => undefined);
  };

  const handleRefresh = (): void => {
    actions
      .refresh()
      .then(() => undefined)
      .catch(() => undefined);
  };

  const handleUserInfo = (): void => {
    actions
      .userinfo(true)
      .then(() => undefined)
      .catch(() => undefined);
  };

  const handleRevoke = (): void => {
    actions
      .revoke()
      .then(() => undefined)
      .catch(() => undefined);
  };

  const handleLogout = (): void => {
    actions
      .logout()
      .then(() => undefined)
      .catch(() => undefined);
  };

  useEffect(() => {
    actions.restore().catch(() => undefined);
  }, [actions]);

  const userinfoSummaryItems = useMemo<KeyValueItem[]>(() => {
    if (!state.userInfo) {
      return [];
    }
    return [
      { label: 'Name', value: String(state.userInfo.name ?? '') },
      { label: 'Given Name', value: String(state.userInfo.given_name ?? '') },
      { label: 'Family Name', value: String(state.userInfo.family_name ?? '') },
      { label: 'Email', value: String(state.userInfo.email ?? '') },
      { label: 'Preferred Username', value: String(state.userInfo.preferred_username ?? '') },
      { label: 'Sub', value: String(state.userInfo.sub ?? '') },
    ];
  }, [state.userInfo]);

  return (
    <>
      <OidcActionsCard
        loading={state.isLoading}
        isAuthenticated={state.isAuthenticated}
        onAuthorize={handleAuthorize}
        onToken={handleToken}
        onRefresh={handleRefresh}
        onUserinfo={handleUserInfo}
        onRevoke={handleRevoke}
        onLogout={handleLogout}
      />

      <CardSection title="Summary">
        <Text style={commonStyles.codeText}>
          {state.isAuthenticated ? 'Authenticated' : 'Not authenticated'}
        </Text>
        <AsyncActionButton
          label="Restore Session"
          variant="secondary"
          onPress={handleRestore}
          loading={state.isLoading}
        />

        {state.userInfo ? (
          <View style={commonStyles.codeBox}>
            <Text style={commonStyles.codeTitle}>Userinfo Summary</Text>
            <KeyValueList items={userinfoSummaryItems} textStyle={commonStyles.codeText} />
            <AsyncActionButton
              label={showRawUserInfo ? 'Hide Raw User Info' : 'Show Raw User Info'}
              variant="secondary"
              onPress={() => setShowRawUserInfo((previous) => !previous)}
            />
            {showRawUserInfo ? (
              <PayloadViewer payload={JSON.stringify(state.userInfo, null, 2)} />
            ) : null}
          </View>
        ) : null}
      </CardSection>

      {state.tokens ? (
        <CardSection title="Tokens">
          <PayloadViewer payload={JSON.stringify(state.tokens, null, 2)} />
        </CardSection>
      ) : null}

      {state.error ? (
        <CardSection title="Error">
          <PayloadViewer payload={JSON.stringify(state.error, null, 2)} />
        </CardSection>
      ) : null}

      <CardSection title="Client Config">
        <PayloadViewer payload={JSON.stringify(clientConfig, null, 2)} />
      </CardSection>
    </>
  );
}

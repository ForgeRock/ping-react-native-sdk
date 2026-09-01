/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useMemo, useState } from 'react';
import {
  DeviceAuthGrantProvider,
  useDeviceAuthGrant,
} from '@ping-identity/rn-oidc';
import { Button, Text, View } from 'react-native';
import { LaunchArguments } from 'react-native-launch-arguments';
import {
  createOidcDeviceClient,
  type OidcDeviceFlowStatus,
} from '@ping-identity/rn-oidc';

/** Deterministic OIDC device-flow scenario used by integration and Detox tests. */
function DeviceFlowHarness({
  forcedStatus,
}: {
  forcedStatus: string;
}): React.JSX.Element {
  const [{ status }, actions] = useDeviceAuthGrant();
  const [forcedTerminalStatus, setForcedTerminalStatus] =
    useState<OidcDeviceFlowStatus | null>(null);
  const [started, setStarted] = useState(false);
  const effectiveStatus = forcedTerminalStatus ?? status;

  const start = async () => {
    if (started) return;
    setStarted(true);
    if (
      forcedStatus === 'expired' ||
      forcedStatus === 'accessDenied' ||
      forcedStatus === 'failure'
    ) {
      setForcedTerminalStatus({ type: forcedStatus } as OidcDeviceFlowStatus);
      return;
    }
    await actions.authorize();
  };

  return (
    <View>
      <Button
        testID="oidc-device-start-btn"
        title="Start Device Authorization"
        onPress={() => void start()}
      />
      {effectiveStatus?.type === 'started' ? (
        <Text testID="oidc-device-user-code">
          {effectiveStatus.response.userCode}
        </Text>
      ) : null}
      {effectiveStatus?.type === 'started' ? (
        <Text testID="oidc-device-verification-uri">
          {effectiveStatus.response.verificationUri}
        </Text>
      ) : null}
      {effectiveStatus?.type === 'polling' ? (
        <Text testID="oidc-device-polling">
          Polling {effectiveStatus.pollCount}
        </Text>
      ) : null}
      {effectiveStatus?.type === 'success' ? (
        <Text testID="oidc-device-success">Success</Text>
      ) : null}
      {effectiveStatus?.type === 'expired' ? (
        <Text testID="oidc-device-expired">Expired</Text>
      ) : null}
      {effectiveStatus?.type === 'accessDenied' ? (
        <Text testID="oidc-device-access-denied">Access denied</Text>
      ) : null}
      {effectiveStatus?.type === 'failure' ? (
        <Text testID="oidc-device-error">Failure</Text>
      ) : null}
    </View>
  );
}

export default function OidcDeviceFlowScenario(): React.JSX.Element {
  const args = LaunchArguments.value<{ PING_OIDC_DEVICE_STATUS?: string }>();
  const forcedStatus = args.PING_OIDC_DEVICE_STATUS ?? 'success';
  const client = useMemo(
    () =>
      createOidcDeviceClient({
        clientId: 'device-test-client',
        discoveryEndpoint:
          'https://example.com/.well-known/openid-configuration',
        redirectUri: 'org.forgerock.demo://oauth2redirect',
        scopes: ['openid'],
      }),
    [],
  );

  return (
    <DeviceAuthGrantProvider client={client}>
      <DeviceFlowHarness forcedStatus={forcedStatus} />
    </DeviceAuthGrantProvider>
  );
}

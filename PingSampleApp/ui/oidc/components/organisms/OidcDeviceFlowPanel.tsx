/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Linking, Text, View } from 'react-native';
import {
  useDeviceAuthGrant,
  type OidcDeviceFlowStatus,
} from '@ping-identity/rn-oidc';
import { commonStyles } from '../../../../src/styles/common';
import AsyncActionButton from '../../../components/molecules/AsyncActionButton';
import CardSection from '../../../components/molecules/CardSection';
import PayloadViewer from '../../../components/atoms/PayloadViewer';

type Props = Record<string, never>;

/**
 * Human-readable status text per {@link OidcDeviceFlowStatus}, mirroring the
 * messaging used by the native Android/iOS sample apps for this flow.
 */
function statusMessageFor(status: OidcDeviceFlowStatus | null): string {
  if (!status) return '';
  switch (status.type) {
    case 'started':
      return 'Open the URL and enter the user code.';
    case 'polling':
      return `Waiting for approval... (attempt ${status.pollCount})`;
    case 'success':
      return 'Authorization successful.';
    case 'expired':
      return 'The device code has expired. Please start again.';
    case 'accessDenied':
      return 'Access denied by user.';
    case 'failure':
      return status.error.message || 'Device authorization failed.';
    default:
      return '';
  }
}

/** Maps a status to the testID used by integration/E2E tests, if any. */
function statusTestId(status: OidcDeviceFlowStatus | null): string | undefined {
  switch (status?.type) {
    case 'polling':
      return 'oidc-device-polling';
    case 'success':
      return 'oidc-device-success';
    case 'expired':
      return 'oidc-device-expired';
    case 'accessDenied':
      return 'oidc-device-access-denied';
    default:
      return undefined;
  }
}

/** Renders the RFC 8628 device authorization lifecycle for the sample app. */
export default function OidcDeviceFlowPanel(_props: Props) {
  const [
    {
      status,
      authorizationResponse,
      isFlowActive,
      isLoading,
      error,
      isAuthenticated,
    },
    actions,
  ] = useDeviceAuthGrant();

  const start = async (): Promise<void> => {
    try {
      await actions.authorize();
    } catch {
      // The hook exposes the typed error through shared state.
    }
  };

  const cancel = (): void => {
    actions.cancel();
  };

  const openVerificationUri = () => {
    const uri =
      authorizationResponse?.verificationUriComplete ??
      authorizationResponse?.verificationUri;
    if (uri) void Linking.openURL(uri);
  };

  const startLabel =
    status?.type === 'success'
      ? 'Restart Device Authorization'
      : isFlowActive
        ? 'In Progress...'
        : status
          ? 'Try Again'
          : 'Start Device Authorization';
  const statusMessage = statusMessageFor(status);

  return (
    <CardSection title="OIDC Device Authorization" subtitle="RFC 8628">
      <View>
        <AsyncActionButton
          label={startLabel}
          onPress={start}
          loading={isLoading}
          disabled={isFlowActive}
          style={commonStyles.buttonGridItem}
        />
        {isFlowActive ? (
          <AsyncActionButton
            label="Cancel"
            variant="secondary"
            onPress={cancel}
            style={commonStyles.buttonGridItem}
          />
        ) : null}
        {authorizationResponse ? (
          <View testID="oidc-device-started" style={commonStyles.codeBox}>
            <Text style={commonStyles.codeTitle}>User Code</Text>
            <Text testID="oidc-device-user-code" style={commonStyles.codeText}>
              {authorizationResponse.userCode.toUpperCase()}
            </Text>
            <Text style={commonStyles.codeTitle}>Verification URI</Text>
            <Text
              testID="oidc-device-verification-uri"
              style={commonStyles.codeText}
            >
              {authorizationResponse.verificationUriComplete ??
                authorizationResponse.verificationUri}
            </Text>
            <AsyncActionButton
              label="Open in Browser"
              variant="secondary"
              onPress={openVerificationUri}
              style={commonStyles.buttonGridItem}
            />
          </View>
        ) : null}
        {statusMessage && status?.type !== 'failure' ? (
          <Text testID={statusTestId(status)} style={commonStyles.codeText}>
            {statusMessage}
          </Text>
        ) : null}
        {status?.type === 'success' && isAuthenticated ? (
          <Text style={commonStyles.codeText}>User signed in.</Text>
        ) : null}
        {error ? (
          <Text testID="oidc-device-error" style={commonStyles.codeText}>
            {error.message}
          </Text>
        ) : null}
        {status ? (
          <PayloadViewer payload={JSON.stringify(status, null, 2)} />
        ) : null}
      </View>
    </CardSection>
  );
}

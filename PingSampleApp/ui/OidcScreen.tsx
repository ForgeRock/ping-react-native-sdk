import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { commonStyles } from '../src/styles/common';
import {
  createOidcClient,
  createOidcWebClient,
  OidcAuthorizeResult,
} from '@ping-identity/rn-oidc';

export default function OidcScreen() {
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleAuthorize = async () => {
    setError('');
    setResult('');

    try {
      const client = createOidcClient({
        clientId: 'test-oidc',
        discoveryEndpoint: 'https://example.com/.well-known/openid-configuration',
        redirectUri: 'com.pingidentity.rnsampleapp://callback',
        scopes: ['openid', 'profile'],
      });

      const webClient = createOidcWebClient(client);
      const outcome: OidcAuthorizeResult = await webClient.authorize();

      setResult(JSON.stringify({ clientId: client.id, webClientId: webClient.id, outcome }, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View style={commonStyles.container}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.codeTitle}>OIDC Link Test</Text>
        <Text style={commonStyles.codeText}>
          Tap to call the native authorize stub.
        </Text>

        <TouchableOpacity
          style={commonStyles.buttonPrimary}
          onPress={handleAuthorize}
        >
          <Text style={commonStyles.buttonText}>Run authorize()</Text>
        </TouchableOpacity>

        {result ? (
          <Text style={commonStyles.textSuccess}>Result: {result}</Text>
        ) : null}

        {error ? (
          <Text style={commonStyles.textError}>Error: {error}</Text>
        ): null}
      </View>
    </View>
  );
}

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { open } from '@react-native-pingidentity/browser';
import { commonStyles } from '../src/styles/common';

export default function BrowserScreen() {
  const [url, setUrl] = useState(
    'https://www.pingidentity.com',
  );
  const [callbackUrlScheme, setCallbackUrlScheme] = useState(
    'com.pingidentity.sampleapp',
  );
  const [redirectUri, setRedirectUri] = useState(
    'com.pingidentity.sampleapp://callback',
  );
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const suggestedUrls = [
    'https://www.pingidentity.com',
    'https://httpbin.org/redirect-to?url=com.pingidentity.sampleapp://callback?code=123',
  ];

  const handleOpen = async (overrideUrl?: string) => {
    setError('');
    setResult('');

    try {
      const response = await open(overrideUrl ?? url, {
        callbackUrlScheme,
        redirectUri: redirectUri.trim() ? redirectUri : undefined,
        ios: {
          browserMode: 'login',
          browserType: 'ephemeralAuthSession'
        }
      });
      setResult(JSON.stringify(response, null, 2));
    } catch (e: any) {
      setError(e?.message ?? 'Browser open failed');
    }
  };


  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.journeySectionTitle}>🧭 Browser</Text>

        <Text style={commonStyles.inputLabel}>URL</Text>
        <TextInput
          style={commonStyles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://example.com"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={commonStyles.suggestionContainer}>
          {suggestedUrls.map(item => (
            <TouchableOpacity
              key={item}
              onPress={() => setUrl(item)}
              style={commonStyles.suggestionChip}
            >
              <Text style={commonStyles.suggestionText}>🔗 {item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={commonStyles.inputLabel}>Callback URL Scheme</Text>
        <TextInput
          style={commonStyles.input}
          value={callbackUrlScheme}
          onChangeText={setCallbackUrlScheme}
          placeholder="myapp"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={commonStyles.inputLabel}>Redirect URI (optional)</Text>
        <TextInput
          style={commonStyles.input}
          value={redirectUri}
          onChangeText={setRedirectUri}
          placeholder="myapp://callback"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={commonStyles.buttonPrimary}
          onPress={() => handleOpen()}
        >
          <Text style={commonStyles.buttonText}>Open Browser</Text>
        </TouchableOpacity>

        {error ? <Text style={commonStyles.textError}>{error}</Text> : null}
      </View>

      {result ? (
        <View style={commonStyles.codeBox}>
          <Text style={commonStyles.codeTitle}>Result</Text>
          <Text style={commonStyles.codeText}>{result}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

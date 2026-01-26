import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { commonStyles } from '../src/styles/common';
import { multiply } from '@ping-identity/rn-oidc';

export default function OidcScreen() {
  const [result, setResult] = useState<number | null>(null);

  const handleMultiply = () => {
    const value = multiply(6, 7);
    setResult(value);
  };

  return (
    <View style={commonStyles.container}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.codeTitle}>OIDC Link Test</Text>
        <Text style={commonStyles.codeText}>
          Tap to call the native multiply method.
        </Text>

        <TouchableOpacity
          style={commonStyles.buttonPrimary}
          onPress={handleMultiply}
        >
          <Text style={commonStyles.buttonText}>Run multiply(6, 7)</Text>
        </TouchableOpacity>

        {result !== null && (
          <Text style={commonStyles.textSuccess}>Result: {result}</Text>
        )}
      </View>
    </View>
  );
}

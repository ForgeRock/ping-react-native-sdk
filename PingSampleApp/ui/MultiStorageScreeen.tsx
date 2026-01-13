import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { commonStyles } from '../src/styles/common';
import {
  getTokenStorages,
  configureOidcStorage,
  configureSessionStorage,
} from '../src/tokenStorages';

export default function MultiStorageScreen() {
  const [oidcStorage, setOidcStorage] = useState(
    () => getTokenStorages().oidcStorage,
  );
  const [sessionStorage, setSessionStorage] = useState(
    () => getTokenStorages().sessionStorage,
  );

  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      {/* OIDC STORAGE CARD */}
      <View style={commonStyles.card}>
        <Text style={commonStyles.journeySectionTitle}>🔑 OIDC Storage</Text>

        {!oidcStorage ? (
          <TouchableOpacity
            style={commonStyles.buttonPrimary}
            onPress={() => {
              setOidcStorage(configureOidcStorage());
            }}
          >
            <Text style={commonStyles.buttonText}>Configure OIDC Storage</Text>
          </TouchableOpacity>
        ) : (
          <Text style={commonStyles.textSmall}>
            Storage ID: {oidcStorage.id}
          </Text>
        )}
      </View>

      {/* SESSION STORAGE CARD */}
      <View style={commonStyles.card}>
        <Text style={commonStyles.journeySectionTitle}>🎫 Session Storage</Text>

        {!sessionStorage ? (
          <TouchableOpacity
            style={commonStyles.buttonPrimary}
            onPress={() => {
              setSessionStorage(configureSessionStorage());
            }}
          >
            <Text style={commonStyles.buttonText}>Configure Session Storage</Text>
          </TouchableOpacity>
        ) : (
          <Text style={commonStyles.textSmall}>
            Storage ID: {sessionStorage.id}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
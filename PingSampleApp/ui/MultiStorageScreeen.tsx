/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */
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
  configureOidcStorageInfo,
  configureSessionStorageInfo,
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
              setOidcStorage(configureOidcStorageInfo());
            }}
          >
            <Text style={commonStyles.buttonText}>Configure OIDC Storage</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <Text style={commonStyles.textSmall}>
              Storage ID: {oidcStorage.id}
            </Text>
            <Text style={commonStyles.textSmall}>
              Config: {JSON.stringify(oidcStorage.config, null, 2)}
            </Text>
          </View>
        )}
      </View>

      {/* SESSION STORAGE CARD */}
      <View style={commonStyles.card}>
        <Text style={commonStyles.journeySectionTitle}>🎫 Session Storage</Text>

        {!sessionStorage ? (
          <TouchableOpacity
            style={commonStyles.buttonPrimary}
            onPress={() => {
              setSessionStorage(configureSessionStorageInfo());
            }}
          >
            <Text style={commonStyles.buttonText}>Configure Session Storage</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <Text style={commonStyles.textSmall}>
              Storage ID: {sessionStorage.id}
            </Text>
            <Text style={commonStyles.textSmall}>
              Config: {JSON.stringify(sessionStorage.config, null, 2)}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

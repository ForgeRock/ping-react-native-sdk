/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * EnvScenario renders effective launch-argument environment values used by E2E.
 * This is intended for quick local verification before running live scenarios.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LaunchArguments } from 'react-native-launch-arguments';

interface EnvLaunchArgs {
  PING_SERVER_URL?: string;
  PING_REALM_PATH?: string;
  PING_COOKIE_NAME?: string;
  PING_JOURNEY_NAME?: string;
  PING_DISCOVERY_ENDPOINT?: string;
  PING_CLIENT_ID?: string;
  PING_REDIRECT_URI?: string;
  PING_TEST_USERNAME?: string;
  PING_TEST_PASSWORD?: string;
}

function maskSecret(value: string): string {
  if (!value) {
    return '';
  }
  if (value.length <= 2) {
    return '*'.repeat(value.length);
  }
  return `${value[0]}${'*'.repeat(Math.max(1, value.length - 2))}${value[value.length - 1]}`;
}

function envValue(value: string | undefined): string {
  return value?.trim() ? value : '(empty)';
}

function EnvRow({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID: string;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

export default function EnvScenario(): React.JSX.Element {
  const args = LaunchArguments.value<EnvLaunchArgs>();
  const password = args.PING_TEST_PASSWORD ?? '';

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" testID="env-screen">
      <View style={styles.container}>
        <Text style={styles.title} testID="env-title">
          E2E Environment Values
        </Text>
        <Text style={styles.note}>
          Values shown below are runtime launch arguments passed to the app.
        </Text>

        <EnvRow label="PING_SERVER_URL" value={envValue(args.PING_SERVER_URL)} testID="env-ping-server-url" />
        <EnvRow label="PING_REALM_PATH" value={envValue(args.PING_REALM_PATH)} testID="env-ping-realm-path" />
        <EnvRow label="PING_COOKIE_NAME" value={envValue(args.PING_COOKIE_NAME)} testID="env-ping-cookie-name" />
        <EnvRow label="PING_JOURNEY_NAME" value={envValue(args.PING_JOURNEY_NAME)} testID="env-ping-journey-name" />
        <EnvRow
          label="PING_DISCOVERY_ENDPOINT"
          value={envValue(args.PING_DISCOVERY_ENDPOINT)}
          testID="env-ping-discovery-endpoint"
        />
        <EnvRow label="PING_CLIENT_ID" value={envValue(args.PING_CLIENT_ID)} testID="env-ping-client-id" />
        <EnvRow label="PING_REDIRECT_URI" value={envValue(args.PING_REDIRECT_URI)} testID="env-ping-redirect-uri" />
        <EnvRow label="PING_TEST_USERNAME" value={envValue(args.PING_TEST_USERNAME)} testID="env-ping-test-username" />
        <EnvRow
          label="PING_TEST_PASSWORD"
          value={password ? maskSecret(password) : '(empty)'}
          testID="env-ping-test-password-masked"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
  },
  note: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 4,
  },
  row: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fafafa',
  },
  label: {
    fontSize: 12,
    color: '#555555',
    marginBottom: 3,
  },
  value: {
    fontSize: 13,
    color: '#111111',
  },
});

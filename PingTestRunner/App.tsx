/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * PingTestRunner App
 *
 * Minimal host application for automated integration and E2E testing.
 * This app provides a stable, dependency-light target for Detox E2E tests
 * and does not include any sample/demo UI.
 *
 * Test screens are only rendered when a PING_TEST_SCENARIO env var is present,
 * so the debug build remains a valid host for all test scenarios without
 * shipping demo logic to production.
 */

import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container} testID="ping-test-runner-root">
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header} testID="ping-test-runner-header">
          <Text style={styles.title} testID="ping-test-runner-title">
            PingTestRunner
          </Text>
          <Text style={styles.subtitle}>
            Automated integration and E2E test host
          </Text>
        </View>
        <View style={styles.body} testID="ping-test-runner-body">
          <Text style={styles.info}>
            This app is not intended for human interaction.{'\n'}
            Run tests via the Detox or Jest CLI.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  body: {
    padding: 24,
  },
  info: {
    fontSize: 14,
    color: '#777',
    lineHeight: 22,
  },
});

export default App;

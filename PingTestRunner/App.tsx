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
 * Reads PING_TEST_SCENARIO from Detox launchArgs and renders the matching
 * scenario screen. When no scenario is set the default static UI is shown,
 * keeping app-launch.test.ts passing in every build.
 */

import React from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LaunchArguments } from 'react-native-launch-arguments';

// Scenario screens — imported lazily via standard requires so they are only
// evaluated when actually needed, keeping the default bundle small.
const JourneyScenario = React.lazy(() => import('./scenarios/JourneyScenario'));
const OidcScenario = React.lazy(() => import('./scenarios/OidcScenario'));
const DeviceIdScenario = React.lazy(() => import('./scenarios/DeviceIdScenario'));
const DeviceProfileScenario = React.lazy(() => import('./scenarios/DeviceProfileScenario'));
const StorageScenario = React.lazy(() => import('./scenarios/StorageScenario'));
const LoggerScenario = React.lazy(() => import('./scenarios/LoggerScenario'));
const BrowserScenario = React.lazy(() => import('./scenarios/BrowserScenario'));
const UseJourneyScenario = React.lazy(() => import('./scenarios/UseJourneyScenario'));
const UseOidcScenario = React.lazy(() => import('./scenarios/UseOidcScenario'));
const EnvScenario = React.lazy(() => import('./scenarios/EnvScenario'));

interface LaunchArgs {
  PING_TEST_SCENARIO?: string;
}

const SCENARIO_TOP_PADDING = Platform.OS === 'android'
  ? Math.max((StatusBar.currentHeight ?? 0) + 8, 40)
  : 16;

function ScenarioContent(): React.JSX.Element {
  const { PING_TEST_SCENARIO } = LaunchArguments.value<LaunchArgs>();

  switch (PING_TEST_SCENARIO) {
    case 'journey':
    case 'journey-failure':
      return <JourneyScenario />;
    case 'oidc':
    case 'oidc-failure':
      return <OidcScenario testScenario={PING_TEST_SCENARIO} />;
    case 'device-id':
      return <DeviceIdScenario />;
    case 'device-profile':
      return <DeviceProfileScenario />;
    case 'storage':
      return <StorageScenario />;
    case 'logger':
      return <LoggerScenario />;
    case 'browser':
      return <BrowserScenario />;
    case 'use-journey':
      return <UseJourneyScenario />;
    case 'use-oidc':
      return <UseOidcScenario />;
    case 'use-oidc-error':
      return <UseOidcScenario forceError />;
    case 'env':
      return <EnvScenario />;
    default:
      return <DefaultView />;
  }
}

function DefaultView(): React.JSX.Element {
  return (
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
  );
}

function App(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container} testID="ping-test-runner-root">
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.contentContainer}>
        <React.Suspense fallback={null}>
          <ScenarioContent />
        </React.Suspense>
      </View>
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
  contentContainer: {
    flex: 1,
    paddingTop: SCENARIO_TOP_PADDING,
    paddingHorizontal: 12,
  },
  info: {
    fontSize: 14,
    color: '#777',
    lineHeight: 22,
  },
});

export default App;

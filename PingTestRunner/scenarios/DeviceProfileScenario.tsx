/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * DeviceProfileScenario — headless test screen for device-profile E2E tests.
 *
 * Provides two collection buttons:
 *  - Empty collectors []           (matches Android testDeviceProfileCallbackWithDefaultCollectors)
 *  - Named collectors [platform, hardware]  (matches Android testDeviceProfileCallbackWithCustomCollectors)
 */

import React, { useCallback, useState } from 'react';
import {
  Button,
  Text,
  View,
} from 'react-native';
import { collectDeviceProfile } from '@ping-identity/rn-device-profile';
import type { DeviceProfileCollector } from '@ping-identity/rn-device-profile';

export default function DeviceProfileScenario(): React.JSX.Element {
  const [result, setResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runCollect = useCallback(async (collectors: DeviceProfileCollector[]) => {
    setResult(null);
    setErrorMessage(null);
    try {
      const profile = await collectDeviceProfile(collectors);
      setResult(JSON.stringify(profile));
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <View>
      <Button
        testID="device-profile-collect-empty-btn"
        title="Collect (empty)"
        onPress={() => runCollect([])}
      />
      <Button
        testID="device-profile-collect-named-btn"
        title="Collect (platform, hardware)"
        onPress={() => runCollect(['platform', 'hardware'] as DeviceProfileCollector[])}
      />

      {result !== null && (
        <Text testID="device-profile-result">{result}</Text>
      )}
      {errorMessage !== null && (
        <Text testID="device-profile-error">{errorMessage}</Text>
      )}
    </View>
  );
}

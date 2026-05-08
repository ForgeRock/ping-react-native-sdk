/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * DeviceIdScenario — headless test screen for device-id E2E tests.
 *
 * Exposes two independent buttons so the test can call getDeviceId() twice
 * and compare the results for consistency.
 */

import React, { useCallback, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { getDeviceId } from '@ping-identity/rn-device-id';

export default function DeviceIdScenario(): React.JSX.Element {
  const [result, setResult] = useState<string | null>(null);
  const [result2, setResult2] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGet = useCallback(async () => {
    try {
      const id = await getDeviceId();
      setResult(id);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleGetAgain = useCallback(async () => {
    try {
      const id = await getDeviceId();
      setResult2(id);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <View>
      <Button
        testID="device-id-get-btn"
        title="Get Device ID"
        onPress={handleGet}
      />
      {result !== null && <Text testID="device-id-result">{result}</Text>}

      <Button
        testID="device-id-get-again-btn"
        title="Get Device ID Again"
        onPress={handleGetAgain}
      />
      {result2 !== null && <Text testID="device-id-result-2">{result2}</Text>}

      {errorMessage !== null && (
        <Text testID="device-id-error">{errorMessage}</Text>
      )}
    </View>
  );
}

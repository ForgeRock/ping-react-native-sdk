/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * BrowserScenario — headless test screen for rn-browser E2E tests.
 *
 * Tests the native browser bridge without opening a real browser session:
 *   - configureBrowser() — no-op on iOS, applies config on Android
 *   - resetBrowser()     — no-op on Android, cancels active session on iOS
 *
 * testIDs:
 *   browser-configure-btn    → calls configureBrowser({})
 *   browser-configure-result → visible after configure completes without throwing
 *   browser-reset-btn        → calls resetBrowser()
 *   browser-reset-result     → visible after reset completes without throwing
 *   browser-error            → visible when any call throws
 */

import React, { useCallback, useState } from 'react';
import { Button, Text, View } from 'react-native';
import {
  configureBrowser,
  resetBrowser,
} from '@ping-identity/rn-browser';

type ScenarioState = 'idle' | 'done' | 'error';

export default function BrowserScenario(): React.JSX.Element {
  const [configureState, setConfigureState] = useState<ScenarioState>('idle');
  const [resetState, setResetState] = useState<ScenarioState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfigure = useCallback(() => {
    try {
      configureBrowser({});
      setConfigureState('done');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setConfigureState('error');
    }
  }, []);

  const handleReset = useCallback(() => {
    try {
      resetBrowser();
      setResetState('done');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setResetState('error');
    }
  }, []);

  return (
    <View>
      <Button
        testID="browser-configure-btn"
        title="Configure"
        onPress={handleConfigure}
      />
      {configureState === 'done' && (
        <Text testID="browser-configure-result">Configure OK</Text>
      )}

      <Button
        testID="browser-reset-btn"
        title="Reset"
        onPress={handleReset}
      />
      {resetState === 'done' && (
        <Text testID="browser-reset-result">Reset OK</Text>
      )}

      {errorMessage !== null && (
        <Text testID="browser-error">{errorMessage}</Text>
      )}
    </View>
  );
}

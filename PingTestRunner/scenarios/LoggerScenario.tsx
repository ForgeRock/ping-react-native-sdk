/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * LoggerScenario — headless test screen for logger E2E tests.
 *
 * Matches Android coverage:
 *  - testConsoleLogger  → create debug logger, call all 4 levels
 *  - testWarnLogger     → changeLevel('warn')
 *  - testNoneLogger     → create logger with level 'none'
 */

import React, { useCallback, useRef, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { logger } from '@ping-identity/rn-logger';
import type { LoggerInstance } from '@ping-identity/rn-types';

export default function LoggerScenario(): React.JSX.Element {
  const logRef = useRef<LoggerInstance | null>(null);

  const [ready, setReady] = useState(false);
  const [logged, setLogged] = useState(false);
  const [levelChanged, setLevelChanged] = useState(false);
  const [noneReady, setNoneReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCreate = useCallback(() => {
    try {
      logRef.current = logger({ level: 'debug' });
      setReady(true);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleLog = useCallback(() => {
    if (!logRef.current) {
      return;
    }
    try {
      logRef.current.debug('e2e debug message');
      logRef.current.info('e2e info message');
      logRef.current.warn('e2e warn message');
      logRef.current.error('e2e error message');
      setLogged(true);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleChangeLevel = useCallback(() => {
    if (!logRef.current) {
      return;
    }
    try {
      logRef.current.changeLevel('warn');
      setLevelChanged(true);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleNone = useCallback(() => {
    try {
      logger({ level: 'none' });
      setNoneReady(true);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <View>
      <Button
        testID="logger-create-btn"
        title="Create Logger"
        onPress={handleCreate}
      />
      {ready && <Text testID="logger-ready">Logger ready</Text>}

      <Button
        testID="logger-log-btn"
        title="Log All Levels"
        onPress={handleLog}
      />
      {logged && <Text testID="logger-logged">Logged</Text>}

      <Button
        testID="logger-change-level-btn"
        title="Change Level to Warn"
        onPress={handleChangeLevel}
      />
      {levelChanged && <Text testID="logger-level-changed">Level changed</Text>}

      <Button
        testID="logger-none-btn"
        title="Create None Logger"
        onPress={handleNone}
      />
      {noneReady && <Text testID="logger-none-ready">None logger ready</Text>}

      {errorMessage !== null && (
        <Text testID="logger-error">{errorMessage}</Text>
      )}
    </View>
  );
}

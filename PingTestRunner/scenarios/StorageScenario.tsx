/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * StorageScenario — headless test screen for storage E2E tests.
 *
 * Tests:
 *  - configureSessionStorage with valid config → handle with kind='session'
 *  - configureOidcStorage with valid config    → handle with kind='oidc'
 *  - configureSessionStorage with empty config → either throws or succeeds with native defaults
 */

import React, { useCallback, useState } from 'react';
import {
  Button,
  Text,
  View,
} from 'react-native';
import {
  configureSessionStorage,
  configureOidcStorage,
} from '@ping-identity/rn-storage';
import type { StorageConfig } from '@ping-identity/rn-storage';

export default function StorageScenario(): React.JSX.Element {
  const [sessionResult, setSessionResult] = useState<string | null>(null);
  const [oidcResult, setOidcResult] = useState<string | null>(null);
  const [invalidResult, setInvalidResult] = useState<string | null>(null);
  const [invalidStatus, setInvalidStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSession = useCallback(() => {
    setErrorMessage(null);
    setSessionResult(null);
    try {
      const handle = configureSessionStorage({
        android: { keyAlias: 'e2e-session-key', fileName: 'e2e_session' },
        ios: { account: 'e2e-session' },
      });
      setSessionResult(`${handle.kind}:${handle.id}`);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleOidc = useCallback(() => {
    setErrorMessage(null);
    setOidcResult(null);
    try {
      const handle = configureOidcStorage({
        android: { keyAlias: 'e2e-oidc-key', fileName: 'e2e_oidc' },
        ios: { account: 'e2e-oidc' },
      });
      setOidcResult(`${handle.kind}:${handle.id}`);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const handleInvalid = useCallback(() => {
    setErrorMessage(null);
    setInvalidResult(null);
    setInvalidStatus('idle');
    try {
      const handle = configureSessionStorage({} as StorageConfig);
      if (handle?.kind && handle?.id) {
        setInvalidResult(`${handle.kind}:${handle.id}`);
        setInvalidStatus('success');
      } else {
        setErrorMessage('Storage configuration returned an invalid handle.');
        setInvalidStatus('error');
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setInvalidStatus('error');
    }
  }, []);

  return (
    <View>
      <Button
        testID="storage-session-btn"
        title="Configure Session Storage"
        onPress={handleSession}
      />
      {sessionResult !== null && (
        <Text testID="storage-session-result">{sessionResult}</Text>
      )}

      <Button
        testID="storage-oidc-btn"
        title="Configure OIDC Storage"
        onPress={handleOidc}
      />
      {oidcResult !== null && (
        <Text testID="storage-oidc-result">{oidcResult}</Text>
      )}

      <Button
        testID="storage-invalid-btn"
        title="Configure Invalid Storage"
        onPress={handleInvalid}
      />
      {invalidStatus !== 'idle' && (
        <Text testID="storage-invalid-status">{invalidStatus}</Text>
      )}
      {invalidResult !== null && (
        <Text testID="storage-invalid-result">{invalidResult}</Text>
      )}
      {errorMessage !== null && (
        <Text testID="storage-error">{errorMessage}</Text>
      )}
    </View>
  );
}

/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * BackchannelScenario — headless test screen for AM/AIC transactional
 * backchannel authentication E2E tests.
 *
 * Reads config from Detox launchArgs. When `PING_BACKCHANNEL_REDIRECT_URI` is
 * set the screen starts the Journey via `client.startBackchannel(uri)` and
 * renders whatever node arrives (ContinueNode form / Success / Error /
 * Failure). When it is not set the scenario runs its offline validation
 * matrix: a blank URI (reject path) and a host-mismatched URI (FailureNode
 * resolve path), so the error contract is verifiable without a live gateway
 * transaction.
 */

import React, { useCallback, useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { LaunchArguments } from 'react-native-launch-arguments';
import { createJourneyClient, JourneyError } from '@ping-identity/rn-journey';
import type { JourneyClient, JourneyNode } from '@ping-identity/rn-journey';

// ─── launch args ────────────────────────────────────────────────────────────

interface BackchannelLaunchArgs {
  PING_SERVER_URL?: string;
  PING_REALM_PATH?: string;
  PING_BACKCHANNEL_REDIRECT_URI?: string;
  PING_NO_SESSION?: string;
}

const args = LaunchArguments.value<BackchannelLaunchArgs>();

const SERVER_URL = args.PING_SERVER_URL ?? '';
const REALM_PATH = args.PING_REALM_PATH ?? '/alpha';
const BACKCHANNEL_URI = args.PING_BACKCHANNEL_REDIRECT_URI ?? '';
const NO_SESSION = args.PING_NO_SESSION === 'true';

// ─── state type ─────────────────────────────────────────────────────────────

type ScenarioState =
  | 'idle'
  | 'form'
  | 'success'
  | 'failure'
  | 'amError'
  | 'error';

// ─── component ──────────────────────────────────────────────────────────────

export default function BackchannelScenario(): React.JSX.Element {
  const [state, setState] = useState<ScenarioState>('idle');
  const [client, setClient] = useState<JourneyClient | null>(null);
  const [node, setNode] = useState<JourneyNode | null>(null);
  const [uriInput, setUriInput] = useState<string>(BACKCHANNEL_URI);
  const [result, setResult] = useState<string | null>(null);

  const advanceNode = useCallback((nextNode: JourneyNode) => {
    if (nextNode.type === 'SuccessNode') {
      setState('success');
      setResult('Success');
      return;
    }
    if (nextNode.type === 'ContinueNode') {
      setNode(nextNode);
      setState('form');
      return;
    }
    if (nextNode.type === 'ErrorNode') {
      const message =
        (nextNode as { message?: string }).message ?? 'unknown AM error';
      setResult(message);
      setState('amError');
      return;
    }
    // FailureNode — bridge/network-level failure with its cause message
    const message =
      (nextNode as { message?: string }).message ??
      (nextNode as { cause?: string }).cause ??
      'unknown failure';
    setResult(message);
    setState('failure');
  }, []);

  const ensureClient = useCallback(async (): Promise<JourneyClient> => {
    const journeyClient =
      client ??
      createJourneyClient({
        serverUrl: SERVER_URL,
        realm: REALM_PATH,
        timeout: 25000,
      });
    if (!client) {
      await journeyClient.init();
      setClient(journeyClient);
    }
    return journeyClient;
  }, [client]);

  // ── run with the launch-arg (or typed) URI ─────────────────────────────
  const handleStart = useCallback(async () => {
    try {
      const journeyClient = await ensureClient();
      const uri = uriInput.trim();
      if (!uri) {
        setResult('No backchannel URI provided');
        setState('error');
        return;
      }
      const startNode = await journeyClient.startBackchannel(uri, {
        noSession: NO_SESSION,
      });
      advanceNode(startNode);
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  }, [advanceNode, ensureClient, uriInput]);

  // ── offline validation matrix (no gateway transaction required) ────────
  const handleValidationMatrix = useCallback(async () => {
    try {
      const journeyClient = await ensureClient();
      // Case 1: blank URI throws argument_error before any native call.
      try {
        await journeyClient.startBackchannel('   ');
        setResult('blank URI unexpectedly succeeded');
        setState('failure');
        return;
      } catch (e) {
        if (
          !(
            e instanceof JourneyError &&
            e.type === 'argument_error' &&
            e.code === 'JOURNEY_START_ERROR'
          )
        ) {
          const message = e instanceof Error ? e.message : String(e);
          setResult(`blank URI threw unexpected error: ${message}`);
          setState('failure');
          return;
        }
      }
      // Case 2: host mismatch resolves a FailureNode payload (no reject).
      const mismatched = await journeyClient.startBackchannel(
        'https://evil.example.com/am/UI/Login?authIndexType=transaction&authIndexValue=abc-123',
      );
      if (mismatched.type !== 'FailureNode') {
        setResult(`host mismatch produced ${mismatched.type}`);
        setState('failure');
        return;
      }
      setResult('validation matrix passed');
      setState('success');
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  }, [ensureClient]);

  // ── submit continue-node callbacks (login credential flows) ────────────
  const [credential, setCredential] = useState({ username: '', password: '' });

  const handleSubmit = useCallback(async () => {
    if (!client || !node) {
      return;
    }
    try {
      const nextNode = await client.next({
        callbacks: (node.callbacks ?? []).map((callback, index) => {
          if (callback.type === 'NameCallback') {
            return {
              type: callback.type,
              index,
              value: credential.username,
            };
          }
          if (callback.type === 'PasswordCallback') {
            return {
              type: callback.type,
              index,
              value: credential.password,
            };
          }
          return { type: callback.type, index, value: '' };
        }),
      });
      advanceNode(nextNode);
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
      setState('failure');
    }
  }, [advanceNode, client, credential, node]);

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <View>
      <TextInput
        testID="backchannel-uri-input"
        value={uriInput}
        onChangeText={setUriInput}
        placeholder="Gateway redirect URI"
        autoCapitalize="none"
      />
      <Button
        testID="backchannel-start-btn"
        title="Start Backchannel"
        onPress={handleStart}
      />
      <Button
        testID="backchannel-validation-btn"
        title="Run Validation Matrix"
        onPress={handleValidationMatrix}
      />

      {state === 'form' && node && (
        <View>
          <Text testID="backchannel-continue-node">ContinueNode</Text>
          {(node.callbacks ?? []).some((cb) => cb.type === 'NameCallback') && (
            <TextInput
              testID="backchannel-credential-username"
              value={credential.username}
              onChangeText={(text) =>
                setCredential((prev) => ({ ...prev, username: text }))
              }
              placeholder="Username"
              autoCapitalize="none"
            />
          )}
          {(node.callbacks ?? []).some(
            (cb) => cb.type === 'PasswordCallback',
          ) && (
            <TextInput
              testID="backchannel-credential-password"
              value={credential.password}
              onChangeText={(text) =>
                setCredential((prev) => ({ ...prev, password: text }))
              }
              placeholder="Password"
              secureTextEntry
            />
          )}
          <Button
            testID="backchannel-submit-btn"
            title="Submit"
            onPress={handleSubmit}
          />
        </View>
      )}

      {state === 'success' && (
        <Text testID="backchannel-success">{result}</Text>
      )}
      {state === 'failure' && (
        <View>
          <Text testID="backchannel-failure">Failure</Text>
          {result !== null && (
            <Text testID="backchannel-failure-message">{result}</Text>
          )}
        </View>
      )}
      {state === 'amError' && (
        <View>
          <Text testID="backchannel-error-node">AM Error</Text>
          {result !== null && (
            <Text testID="backchannel-error-node-message">{result}</Text>
          )}
        </View>
      )}
      {state === 'error' && result !== null && (
        <Text testID="backchannel-error">{result}</Text>
      )}
    </View>
  );
}

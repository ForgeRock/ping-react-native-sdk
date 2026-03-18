/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * JourneyScenario — generic headless test screen for all Journey E2E tests.
 *
 * Reads config from Detox launchArgs and renders a minimal UI that works for
 * every callback type supported by rn-journey.  Each callback field gets a
 * deterministic testID of the form `journey-field-{CallbackType}:{typeIndex}`
 * (e.g. `journey-field-NameCallback:0`) so per-callback test files can locate
 * their specific field without knowing anything about the other callbacks on
 * the node.
 *
 * Auto-handled callbacks (DeviceProfileCallback, TextOutputCallback, etc.) are
 * processed without user interaction and the journey advances automatically.
 */

import React, { useCallback, useState } from 'react';
import {
  Button,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LaunchArguments } from 'react-native-launch-arguments';
import {
  createJourneyClient,
  buildNextInput,
  normalizeCallbacks,
} from '@ping-identity/rn-journey';
import { collectDeviceProfileForJourney } from '@ping-identity/rn-device-profile';
import type {
  JourneyClient,
  JourneyFormValue,
  JourneyFormValues,
  JourneyNode,
  JourneyNormalizedField,
} from '@ping-identity/rn-journey';

// ─── launch args ────────────────────────────────────────────────────────────

interface JourneyLaunchArgs {
  PING_SERVER_URL?: string;
  PING_REALM_PATH?: string;
  PING_JOURNEY_NAME?: string;
  PING_COOKIE_NAME?: string;
  PING_TIMEOUT?: string;
  PING_NO_SESSION?: string;
  PING_CLIENT_ID?: string;
  PING_DISCOVERY_ENDPOINT?: string;
  PING_REDIRECT_URI?: string;
}

const args = LaunchArguments.value<JourneyLaunchArgs>();

const SERVER_URL = args.PING_SERVER_URL ?? '';
const REALM_PATH = args.PING_REALM_PATH ?? '/alpha';
const JOURNEY_NAME = args.PING_JOURNEY_NAME ?? 'Login';
const COOKIE_NAME = args.PING_COOKIE_NAME ?? 'iPlanetDirectoryPro';
const TIMEOUT = args.PING_TIMEOUT ? Number(args.PING_TIMEOUT) : undefined;
const NO_SESSION = args.PING_NO_SESSION === 'true';
const CLIENT_ID = args.PING_CLIENT_ID ?? '';
const DISCOVERY_ENDPOINT = args.PING_DISCOVERY_ENDPOINT ?? '';
const REDIRECT_URI = args.PING_REDIRECT_URI ?? 'org.forgerock.demo://oauth2redirect';

// ─── state type ─────────────────────────────────────────────────────────────

type ScenarioState =
  | 'idle'
  | 'collecting_profile'
  | 'form'
  | 'success'
  | 'failure'
  | 'error';

// ─── component ──────────────────────────────────────────────────────────────

export default function JourneyScenario(): React.JSX.Element {
  const [state, setState] = useState<ScenarioState>('idle');
  const [client, setClient] = useState<JourneyClient | null>(null);
  const [node, setNode] = useState<JourneyNode | null>(null);
  const [formValues, setFormValues] = useState<JourneyFormValues>({});
  const [userinfo, setUserinfo] = useState<string | null>(null);
  const [tokenResult, setTokenResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  // ── advance node after auto-handled callbacks ──────────────────────────
  const advanceNode = useCallback(
    async (journeyClient: JourneyClient, nextNode: JourneyNode) => {
      if (nextNode.type === 'SuccessNode') {
        setState('success');
        try {
          const session = await journeyClient.user();
          if (session?.accessToken) {
            setTokenResult(session.accessToken);
          } else {
            // Journey-only flow (no OIDC) — fall back to SSO token
            const sso = await journeyClient.ssoToken();
            if (sso?.value) {
              setTokenResult(sso.value);
            }
          }
        } catch {
          // token fetch is best-effort; success state already set
        }
        return;
      }
      if (nextNode.type === 'FailureNode') {
        setState('failure');
        return;
      }
      if (nextNode.type === 'ErrorNode') {
        const errorNode = nextNode as {
          message?: string;
          input?: Record<string, unknown>;
        };
        const message = errorNode.message ?? (
          typeof errorNode.input?.['message'] === 'string'
            ? errorNode.input['message']
            : null
        );
        setErrorMessage(message);
        setState('failure');
        return;
      }

      // ContinueNode — check for auto-handled callbacks
      const fields = normalizeCallbacks(nextNode);
      const hasDeviceProfile = fields.some(
        (f) => f.raw && (f.raw as { type?: string }).type === 'DeviceProfileCallback'
      );

      if (hasDeviceProfile) {
        setState('collecting_profile');
        try {
          await collectDeviceProfileForJourney(journeyClient, []);
          const { input } = buildNextInput(nextNode, {});
          const after = await journeyClient.next(input);
          await advanceNode(journeyClient, after);
        } catch (e) {
          setErrorMessage(e instanceof Error ? e.message : String(e));
          setState('error');
        }
        return;
      }

      // Has user-facing fields — show form
      setNode(nextNode);
      setFormValues({});
      setState('form');
    },
    []
  );

  // ── start ──────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    try {
      const journeyClient = createJourneyClient({
        serverUrl: SERVER_URL,
        realm: REALM_PATH,
        cookie: COOKIE_NAME,
        timeout: TIMEOUT ?? 25000,
        ...(CLIENT_ID && DISCOVERY_ENDPOINT ? {
          modules: {
            oidc: {
              clientId: CLIENT_ID,
              discoveryEndpoint: DISCOVERY_ENDPOINT,
              redirectUri: REDIRECT_URI,
              scopes: ['openid', 'profile'],
            },
          },
        } : {}),
      });
      setClient(journeyClient);
      await journeyClient.init();
      const startNode = await journeyClient.start(
        JOURNEY_NAME,
        NO_SESSION ? { noSession: true } : { forceAuth: true }
      );
      await advanceNode(journeyClient, startNode);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  }, [advanceNode]);

  // ── submit form ────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!client || !node) {
      return;
    }
    try {
      const { input } = buildNextInput(node, formValues);
      const nextNode = await client.next(input);
      await advanceNode(client, nextNode);
    } catch (e) {
      // native next() throws on authentication failure (FailureNode surfaced as error)
      const message = e instanceof Error ? e.message : String(e);
      setErrorMessage(message && message !== 'undefined' ? message : null);
      setState('failure');
    }
  }, [client, node, formValues, advanceNode]);

  // ── post-success actions ───────────────────────────────────────────────
  const handleUserinfo = useCallback(async () => {
    if (!client) { return; }
    try {
      const info = await client.userinfo();
      setUserinfo(JSON.stringify(info));
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, [client]);

  const handleRefresh = useCallback(async () => {
    if (!client) { return; }
    try {
      await client.refresh();
      setRefreshed(true);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }, [client]);

  const handleRevoke = useCallback(async () => {
    if (!client) { return; }
    try {
      await client.revoke();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
    setRevoked(true);
  }, [client]);

  const handleLogout = useCallback(async () => {
    if (!client) { return; }
    try {
      await client.logoutUser();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    }
    setLoggedOut(true);
  }, [client]);

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <View>
      {/* Start */}
      <Button testID="journey-start-btn" title="Start" onPress={handleStart} />

      {/* Collecting profile indicator */}
      {state === 'collecting_profile' && (
        <Text testID="journey-collecting-profile">Collecting profile…</Text>
      )}

      {/* Generic callback form */}
      {state === 'form' && node && (
        <View>
          <CallbackFields
            node={node}
            values={formValues}
            onChange={setFormValues}
          />
          <Button
            testID="journey-submit-btn"
            title="Submit"
            onPress={handleSubmit}
          />
        </View>
      )}

      {/* Success */}
      {state === 'success' && (
        <View>
          <Text testID="journey-success">Success</Text>
          {tokenResult !== null && (
            <Text
              testID="journey-token-result"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {tokenResult}
            </Text>
          )}
          <Button
            testID="journey-userinfo-btn"
            title="User Info"
            onPress={handleUserinfo}
          />
          {userinfo !== null && (
            <Text
              testID="journey-userinfo-result"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {userinfo}
            </Text>
          )}
          <Button
            testID="journey-refresh-btn"
            title="Refresh"
            onPress={handleRefresh}
          />
          {refreshed && <Text testID="journey-refreshed">Refreshed</Text>}
          <Button
            testID="journey-revoke-btn"
            title="Revoke"
            onPress={handleRevoke}
          />
          {revoked && <Text testID="journey-revoked">Revoked</Text>}
          <Button
            testID="journey-logout-btn"
            title="Logout"
            onPress={handleLogout}
          />
          {loggedOut && <Text testID="journey-logged-out">Logged out</Text>}
        </View>
      )}

      {/* Failure */}
      {state === 'failure' && (
        <View>
          <Text testID="journey-failure">Failure</Text>
          {errorMessage !== null && (
            <Text testID="journey-failure-message">{errorMessage}</Text>
          )}
          <Button
            testID="journey-revoke-btn"
            title="Revoke"
            onPress={handleRevoke}
          />
          {revoked && <Text testID="journey-revoked">Revoked</Text>}
          {/* Allow re-start after revoke */}
          <Button testID="journey-start-btn" title="Start" onPress={handleStart} />
        </View>
      )}

      {/* Error */}
      {state === 'error' && errorMessage !== null && (
        <Text testID="journey-error">{errorMessage}</Text>
      )}
    </View>
  );
}

// ─── CallbackFields ──────────────────────────────────────────────────────────

interface CallbackFieldsProps {
  node: JourneyNode;
  values: JourneyFormValues;
  onChange: (values: JourneyFormValues) => void;
}

function CallbackFields({ node, values, onChange }: CallbackFieldsProps): React.JSX.Element {
  const fields = normalizeCallbacks(node);
  return (
    <View>
      {fields.map((field) => (
        <FieldInput
          key={field.id}
          field={field}
          value={values[field.id]}
          onValueChange={(val: JourneyFormValue) => onChange({ ...values, [field.id]: val })}
        />
      ))}
    </View>
  );
}

// ─── FieldInput ──────────────────────────────────────────────────────────────

interface FieldInputProps {
  field: JourneyNormalizedField;
  value: JourneyFormValue | undefined;
  onValueChange: (val: JourneyFormValue) => void;
}

function FieldInput({ field, value, onValueChange }: FieldInputProps): React.JSX.Element | null {
  const testID = `journey-field-${field.id}`;

  if (field.kind === 'output') {
    return (
      <Text testID={`journey-field-output-${field.id}`}>
        {field.prompt || field.message || ''}
      </Text>
    );
  }

  if (field.kind === 'boolean') {
    return (
      <Switch
        testID={testID}
        value={typeof value === 'boolean' ? value : false}
        onValueChange={onValueChange}
      />
    );
  }

  if (field.kind === 'number') {
    return (
      <TextInput
        testID={testID}
        keyboardType="numeric"
        value={value !== undefined ? String(value) : ''}
        onChangeText={(t) => onValueChange(t)}
      />
    );
  }

  if (field.kind === 'choice') {
    return (
      <View testID={testID}>
        {(field.options ?? []).map((opt) => (
          <TouchableOpacity
            key={opt.index}
            testID={`${testID}-option-${opt.index}`}
            onPress={() => onValueChange(opt.index)}
          >
            <Text>{String(opt.label)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  if (field.kind === 'kba') {
    const kba = (value as { selectedQuestion: string; selectedAnswer: string; allowUserDefinedQuestions: boolean } | null) ?? { selectedQuestion: '', selectedAnswer: '', allowUserDefinedQuestions: false };
    return (
      <View testID={testID}>
        <TextInput
          testID={`${testID}-question`}
          placeholder="Question"
          value={kba.selectedQuestion}
          onChangeText={(t) =>
            onValueChange({ ...kba, selectedQuestion: t })
          }
        />
        <TextInput
          testID={`${testID}-answer`}
          placeholder="Answer"
          value={kba.selectedAnswer}
          onChangeText={(t) =>
            onValueChange({ ...kba, selectedAnswer: t })
          }
        />
      </View>
    );
  }

  // text / password / unknown
  return (
    <TextInput
      testID={testID}
      secureTextEntry={field.kind === 'password'}
      value={typeof value === 'string' ? value : ''}
      onChangeText={onValueChange}
      placeholder={field.prompt}
    />
  );
}

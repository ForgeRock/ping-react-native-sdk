/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * UseJourneyScenario — headless test screen for useJourney + useJourneyForm E2E tests.
 *
 * Uses the hook API instead of the low-level client API, allowing E2E tests to
 * verify that hook state transitions (loading, error, node updates) work correctly
 * against real native bridges on device.
 *
 * testIDs:
 *   use-journey-start-btn          → calls client.init() then actions.start()
 *   use-journey-loading            → visible while actions.loading === true
 *   use-journey-error              → visible when actions.error !== null
 *   use-journey-field-{fieldId}    → per-callback field (e.g. use-journey-field-NameCallback:0)
 *   use-journey-submit-btn         → calls actions.next(form.input)
 *   use-journey-success            → visible on SuccessNode
 *   use-journey-failure            → visible on FailureNode
 *   use-journey-token-result       → visible after token fetched post-success
 *   use-journey-userinfo-btn       → calls actions.userinfo()
 *   use-journey-userinfo-result    → visible when userinfo returned
 *   use-journey-refresh-btn        → calls actions.refresh()
 *   use-journey-refreshed          → visible after refresh succeeds
 *   use-journey-revoke-btn         → calls actions.revoke()
 *   use-journey-revoked            → visible after revoke
 *   use-journey-logout-btn         → calls actions.logoutUser()
 *   use-journey-logged-out         → visible after logout
 */

import React, { useCallback, useMemo, useState } from 'react';
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
  useJourney,
  useJourneyForm,
} from '@ping-identity/rn-journey';
import type {
  JourneyFormValue,
  JourneyNormalizedField,
} from '@ping-identity/rn-journey';

// ─── launch args ─────────────────────────────────────────────────────────────

interface JourneyLaunchArgs {
  PING_SERVER_URL?: string;
  PING_REALM_PATH?: string;
  PING_JOURNEY_NAME?: string;
  PING_COOKIE_NAME?: string;
  PING_CLIENT_ID?: string;
  PING_DISCOVERY_ENDPOINT?: string;
  PING_REDIRECT_URI?: string;
}

const args = LaunchArguments.value<JourneyLaunchArgs>();
const SERVER_URL = args.PING_SERVER_URL ?? '';
const REALM_PATH = args.PING_REALM_PATH ?? '/alpha';
const JOURNEY_NAME = args.PING_JOURNEY_NAME ?? 'Login';
const COOKIE_NAME = args.PING_COOKIE_NAME ?? 'iPlanetDirectoryPro';
const CLIENT_ID = args.PING_CLIENT_ID ?? '';
const DISCOVERY_ENDPOINT = args.PING_DISCOVERY_ENDPOINT ?? '';
const REDIRECT_URI = args.PING_REDIRECT_URI ?? 'org.forgerock.demo://oauth2redirect';

// ─── component ───────────────────────────────────────────────────────────────

export default function UseJourneyScenario(): React.JSX.Element {
  const client = useMemo(
    () =>
      createJourneyClient({
        serverUrl: SERVER_URL,
        realm: REALM_PATH,
        cookie: COOKIE_NAME,
        timeout: 25000,
        ...(CLIENT_ID && DISCOVERY_ENDPOINT
          ? {
              modules: {
                oidc: {
                  clientId: CLIENT_ID,
                  discoveryEndpoint: DISCOVERY_ENDPOINT,
                  redirectUri: REDIRECT_URI,
                  scopes: ['openid', 'profile'],
                },
              },
            }
          : {}),
      }),
    []
  );

  const [node, actions] = useJourney(client);
  const form = useJourneyForm(node);

  const [tokenResult, setTokenResult] = useState<string | null>(null);
  const [userinfo, setUserinfo] = useState<string | null>(null);
  const [refreshed, setRefreshed] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);

  const fetchToken = useCallback(async () => {
    try {
      const session = await actions.user();
      if (session?.accessToken) {
        setTokenResult(session.accessToken);
        return;
      }
      const sso = await actions.ssoToken();
      if (sso?.value) {
        setTokenResult(sso.value);
      }
    } catch {
      // token fetch is best-effort
    }
  }, [actions]);

  const handleStart = useCallback(async () => {
    try {
      await client.init();
      const firstNode = await actions.start(JOURNEY_NAME, { forceAuth: true });
      if (firstNode.type === 'SuccessNode') {
        await fetchToken();
      }
    } catch {
      // actions.error updated by hook
    }
  }, [client, actions, fetchToken]);

  const handleSubmit = useCallback(async () => {
    try {
      const nextNode = await actions.next(form.input);
      if (nextNode.type === 'SuccessNode') {
        await fetchToken();
      }
    } catch {
      // actions.error updated by hook
    }
  }, [actions, form.input, fetchToken]);

  const handleUserinfo = useCallback(async () => {
    try {
      const info = await actions.userinfo();
      setUserinfo(JSON.stringify(info));
    } catch {
      // actions.error updated by hook
    }
  }, [actions]);

  const handleRefresh = useCallback(async () => {
    try {
      await actions.refresh();
      setRefreshed(true);
    } catch {
      // actions.error updated by hook
    }
  }, [actions]);

  const handleRevoke = useCallback(async () => {
    try {
      await actions.revoke();
    } catch {
      // actions.error updated by hook
    }
    setRevoked(true);
  }, [actions]);

  const handleLogout = useCallback(async () => {
    try {
      await actions.logoutUser();
    } catch {
      // actions.error updated by hook
    }
    setLoggedOut(true);
  }, [actions]);

  return (
    <View>
      <Button
        testID="use-journey-start-btn"
        title="Start"
        onPress={handleStart}
      />

      {actions.loading && (
        <Text testID="use-journey-loading">Loading…</Text>
      )}

      {actions.error !== null && (
        <Text testID="use-journey-error">{actions.error.message}</Text>
      )}

      {node?.type === 'ContinueNode' && !actions.loading && (
        <View>
          {form.fields.map((field) => (
            <HookFieldInput
              key={field.id}
              field={field}
              value={form.values[field.id]}
              onValueChange={(val) => form.setValue(field.id, val)}
            />
          ))}
          <Button
            testID="use-journey-submit-btn"
            title="Submit"
            onPress={handleSubmit}
          />
        </View>
      )}

      {node?.type === 'SuccessNode' && (
        <View>
          <Text testID="use-journey-success">Success</Text>
          {tokenResult !== null && (
            <Text
              testID="use-journey-token-result"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {tokenResult}
            </Text>
          )}
          <Button
            testID="use-journey-userinfo-btn"
            title="User Info"
            onPress={handleUserinfo}
          />
          {userinfo !== null && (
            <Text
              testID="use-journey-userinfo-result"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {userinfo}
            </Text>
          )}
          <Button
            testID="use-journey-refresh-btn"
            title="Refresh"
            onPress={handleRefresh}
          />
          {refreshed && <Text testID="use-journey-refreshed">Refreshed</Text>}
          <Button
            testID="use-journey-revoke-btn"
            title="Revoke"
            onPress={handleRevoke}
          />
          {revoked && <Text testID="use-journey-revoked">Revoked</Text>}
          <Button
            testID="use-journey-logout-btn"
            title="Logout"
            onPress={handleLogout}
          />
        </View>
      )}

      {loggedOut && <Text testID="use-journey-logged-out">Logged out</Text>}

      {(node?.type === 'FailureNode' || node?.type === 'ErrorNode') && (
        <Text testID="use-journey-failure">
          {node.cause ?? node.message ?? 'Failure'}
        </Text>
      )}
    </View>
  );
}

// ─── HookFieldInput ───────────────────────────────────────────────────────────

interface HookFieldInputProps {
  field: JourneyNormalizedField;
  value: JourneyFormValue | undefined;
  onValueChange: (val: JourneyFormValue) => void;
}

function HookFieldInput({
  field,
  value,
  onValueChange,
}: HookFieldInputProps): React.JSX.Element | null {
  const testID = `use-journey-field-${field.id}`;

  if (field.kind === 'output') {
    return (
      <Text testID={`use-journey-field-output-${field.id}`}>
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
    const kba = (value as {
      selectedQuestion: string;
      selectedAnswer: string;
      allowUserDefinedQuestions: boolean;
    } | null) ?? {
      selectedQuestion: '',
      selectedAnswer: '',
      allowUserDefinedQuestions: false,
    };
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

/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * UseDaVinciScenario — headless test screen for useDaVinci + useDaVinciForm E2E tests.
 *
 * Uses the hook API instead of the low-level client API, allowing E2E tests to
 * verify that hook state transitions (loading, error, node updates) work correctly
 * against real native bridges on device.
 *
 * testIDs:
 *   use-davinci-start-btn               → calls actions.start()
 *   use-davinci-loading                 → visible while actions.loading === true
 *   use-davinci-error                   → visible when actions.error !== null
 *   use-davinci-field-{key}             → per-collector field input
 *   use-davinci-field-{key}-option-{v}  → option button for single/multi-select
 *   use-davinci-flow-{key}              → FLOW_BUTTON / FLOW_LINK / ACTION
 *   use-davinci-submit-btn              → calls actions.next(form.input)
 *   use-davinci-success                 → visible on SuccessNode
 *   use-davinci-error-node              → visible on ErrorNode
 *   use-davinci-error-message           → ErrorNode message text
 *   use-davinci-failure                 → visible on FailureNode
 *   use-davinci-failure-message         → FailureNode message text
 *   use-davinci-token-result            → access token after success
 *   use-davinci-userinfo-btn            → calls actions.userinfo()
 *   use-davinci-userinfo-result         → visible when userinfo returned
 *   use-davinci-refresh-btn             → calls actions.refresh()
 *   use-davinci-refreshed               → visible after refresh succeeds
 *   use-davinci-revoke-btn              → calls actions.revoke()
 *   use-davinci-revoked                 → visible after revoke
 *   use-davinci-logout-btn              → calls actions.logoutUser()
 *   use-davinci-logged-out              → visible after logout
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Button, Switch, Text, TextInput, View } from 'react-native';
import { LaunchArguments } from 'react-native-launch-arguments';
import {
  createDaVinciClient,
  useDaVinci,
  useDaVinciForm,
} from '@ping-identity/rn-davinci';
import type {
  DaVinciFormValue,
  DaVinciNormalizedCollector,
} from '@ping-identity/rn-davinci';

// ─── launch args ─────────────────────────────────────────────────────────────

interface DaVinciLaunchArgs {
  PING_DISCOVERY_ENDPOINT?: string;
  PING_CLIENT_ID?: string;
  PING_REDIRECT_URI?: string;
  PING_SCOPES?: string;
  PING_TIMEOUT?: string;
}

const args = LaunchArguments.value<DaVinciLaunchArgs>();
const DISCOVERY_ENDPOINT = args.PING_DISCOVERY_ENDPOINT ?? '';
const CLIENT_ID = args.PING_CLIENT_ID ?? '';
const REDIRECT_URI =
  args.PING_REDIRECT_URI ?? 'org.forgerock.demo://oauth2redirect';
const SCOPES = (args.PING_SCOPES ?? 'openid profile email')
  .split(' ')
  .map((s) => s.trim())
  .filter(Boolean);
const TIMEOUT = args.PING_TIMEOUT ? Number(args.PING_TIMEOUT) : undefined;

// ─── component ───────────────────────────────────────────────────────────────

export default function UseDaVinciScenario(): React.JSX.Element {
  const client = useMemo(
    () =>
      createDaVinciClient({
        modules: {
          oidc: {
            discoveryEndpoint: DISCOVERY_ENDPOINT,
            clientId: CLIENT_ID,
            redirectUri: REDIRECT_URI,
            scopes: SCOPES,
          },
        },
        ...(TIMEOUT !== undefined ? { timeout: TIMEOUT } : {}),
      }),
    [],
  );

  const {
    node,
    loading,
    error,
    start,
    next,
    user,
    userinfo,
    refresh,
    revoke,
    logoutUser,
  } = useDaVinci(client);
  const form = useDaVinciForm(node, { next });

  const [tokenResult, setTokenResult] = useState<string | null>(null);
  const [userinfoResult, setUserinfoResult] = useState<string | null>(null);
  const [refreshed, setRefreshed] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);

  const fetchToken = useCallback(async () => {
    try {
      const session = await user();
      if (session?.accessToken) {
        setTokenResult(session.accessToken);
      }
    } catch {
      // best effort
    }
  }, [user]);

  const handleStart = useCallback(async () => {
    try {
      const firstNode = await start();
      if (firstNode.type === 'SuccessNode') {
        await fetchToken();
      }
    } catch {
      // error updated by hook
    }
  }, [start, fetchToken]);

  const handleSubmit = useCallback(async () => {
    try {
      const nextNode = await next(form.input);
      if (nextNode.type === 'SuccessNode') {
        await fetchToken();
      }
    } catch {
      // error updated by hook
    }
  }, [next, form.input, fetchToken]);

  const handleFlow = useCallback(
    async (flowKey: string) => {
      try {
        await form.submitFlow(flowKey);
      } catch {
        // error updated by hook
      }
    },
    [form],
  );

  const handleUserinfo = useCallback(async () => {
    try {
      const info = await userinfo();
      setUserinfoResult(JSON.stringify(info));
    } catch {
      // error updated by hook
    }
  }, [userinfo]);

  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
      setRefreshed(true);
    } catch {
      // error updated by hook
    }
  }, [refresh]);

  const handleRevoke = useCallback(async () => {
    try {
      await revoke();
      setRevoked(true);
    } catch {
      // error updated by hook
    }
  }, [revoke]);

  const handleLogout = useCallback(async () => {
    try {
      await logoutUser();
      setLoggedOut(true);
    } catch {
      // error updated by hook
    }
  }, [logoutUser]);

  return (
    <View>
      <Button
        testID="use-davinci-start-btn"
        title="Start"
        onPress={handleStart}
      />

      {loading && <Text testID="use-davinci-loading">Loading…</Text>}

      {error !== null && (
        <Text testID="use-davinci-error">{error.message}</Text>
      )}

      {node?.type === 'ContinueNode' && !loading && (
        <View>
          {form.fields.map((field) => (
            <HookCollectorInput
              key={field.key}
              collector={field}
              value={form.values[field.key]}
              onValueChange={(val) => form.setValue(field.key, val)}
              onFlow={handleFlow}
              onSubmit={handleSubmit}
            />
          ))}
          {!form.fields.some((f) => f.type === 'SUBMIT_BUTTON') && (
            <Button
              testID="use-davinci-submit-btn"
              title="Submit"
              onPress={handleSubmit}
            />
          )}
        </View>
      )}

      {node?.type === 'SuccessNode' && (
        <View>
          <Text testID="use-davinci-success">Success</Text>
          {tokenResult !== null && (
            <Text
              testID="use-davinci-token-result"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {tokenResult}
            </Text>
          )}
          <Button
            testID="use-davinci-userinfo-btn"
            title="User Info"
            onPress={handleUserinfo}
          />
          {userinfoResult !== null && (
            <Text
              testID="use-davinci-userinfo-result"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {userinfoResult}
            </Text>
          )}
          <Button
            testID="use-davinci-refresh-btn"
            title="Refresh"
            onPress={handleRefresh}
          />
          {refreshed && <Text testID="use-davinci-refreshed">Refreshed</Text>}
          <Button
            testID="use-davinci-revoke-btn"
            title="Revoke"
            onPress={handleRevoke}
          />
          {revoked && <Text testID="use-davinci-revoked">Revoked</Text>}
          <Button
            testID="use-davinci-logout-btn"
            title="Logout"
            onPress={handleLogout}
          />
        </View>
      )}

      {loggedOut && <Text testID="use-davinci-logged-out">Logged out</Text>}

      {node?.type === 'ErrorNode' && (
        <View>
          <Text testID="use-davinci-error-node">Error</Text>
          <Text testID="use-davinci-error-message">{node.message}</Text>
        </View>
      )}

      {node?.type === 'FailureNode' && (
        <View>
          <Text testID="use-davinci-failure">Failure</Text>
          <Text testID="use-davinci-failure-message">{node.message}</Text>
        </View>
      )}
    </View>
  );
}

// ─── HookCollectorInput ───────────────────────────────────────────────────────

interface HookCollectorInputProps {
  collector: DaVinciNormalizedCollector;
  value: DaVinciFormValue | undefined;
  onValueChange: (val: DaVinciFormValue) => void;
  onFlow: (flowKey: string) => void;
  onSubmit: () => void;
}

function HookCollectorInput({
  collector,
  value,
  onValueChange,
  onFlow,
  onSubmit,
}: HookCollectorInputProps): React.JSX.Element | null {
  const testID = `use-davinci-field-${collector.key}`;

  if (collector.kind === 'output') {
    return (
      <Text testID={`use-davinci-label-${collector.key}`}>
        {(collector as { content?: string }).content ?? ''}
      </Text>
    );
  }

  if (collector.kind === 'flow') {
    if (collector.type === 'SUBMIT_BUTTON') {
      return (
        <Button
          testID="use-davinci-submit-btn"
          title={(collector as { label?: string }).label || 'Submit'}
          onPress={onSubmit}
        />
      );
    }
    return (
      <Button
        testID={`use-davinci-flow-${collector.key}`}
        title={(collector as { label?: string }).label || collector.key}
        onPress={() => onFlow(collector.key)}
      />
    );
  }

  if (collector.kind === 'text' || collector.kind === 'password') {
    return (
      <TextInput
        testID={testID}
        secureTextEntry={collector.kind === 'password'}
        value={typeof value === 'string' ? value : ''}
        onChangeText={onValueChange}
        placeholder={(collector as { label?: string }).label}
      />
    );
  }

  if (collector.kind === 'singleSelect') {
    const options =
      (collector as { options?: Array<{ value: string; label: string }> })
        .options ?? [];
    return (
      <View testID={testID}>
        {options.map((opt) => (
          <Button
            key={opt.value}
            testID={`${testID}-option-${opt.value}`}
            title={opt.label}
            onPress={() => onValueChange(opt.value)}
          />
        ))}
      </View>
    );
  }

  if (collector.kind === 'multiSelect') {
    const options =
      (collector as { options?: Array<{ value: string; label: string }> })
        .options ?? [];
    const selected = Array.isArray(value) ? value : [];
    return (
      <View testID={testID}>
        {options.map((opt) => {
          const isOn = selected.includes(opt.value);
          return (
            <View key={opt.value}>
              <Text>{opt.label}</Text>
              <Switch
                testID={`${testID}-option-${opt.value}`}
                value={isOn}
                onValueChange={(next) => {
                  const updated = next
                    ? [...selected, opt.value]
                    : selected.filter((v) => v !== opt.value);
                  onValueChange(updated);
                }}
              />
            </View>
          );
        })}
      </View>
    );
  }

  if (collector.kind === 'phone') {
    const phone =
      (value as { countryCode?: string; phoneNumber?: string } | undefined) ??
      {};
    const countryCode = (collector as { countryCode?: string }).countryCode;
    return (
      <View testID={testID}>
        <TextInput
          testID={`${testID}-country-code`}
          value={phone.countryCode ?? countryCode ?? ''}
          onChangeText={(t) =>
            onValueChange({
              countryCode: t,
              phoneNumber: phone.phoneNumber ?? '',
            })
          }
          placeholder="Country code"
        />
        <TextInput
          testID={`${testID}-phone-number`}
          keyboardType="phone-pad"
          value={phone.phoneNumber ?? ''}
          onChangeText={(t) =>
            onValueChange({
              countryCode: phone.countryCode ?? countryCode ?? '',
              phoneNumber: t,
            })
          }
          placeholder="Phone number"
        />
      </View>
    );
  }

  if (collector.kind === 'device') {
    const devices =
      (
        collector as {
          devices?: Array<{
            type: string;
            id?: string;
            title: string;
            description?: string;
          }>;
        }
      ).devices ?? [];
    if (collector.type === 'DEVICE_REGISTRATION') {
      return (
        <View testID={testID}>
          {devices.map((device) => (
            <Button
              key={device.type}
              testID={`${testID}-device-${device.type}`}
              title={device.title}
              onPress={() => onValueChange(device.type)}
            />
          ))}
        </View>
      );
    }
    return (
      <View testID={testID}>
        {devices.map((device) => (
          <Button
            key={device.id ?? device.type}
            testID={`${testID}-device-${device.id ?? device.type}`}
            title={device.title}
            onPress={() =>
              onValueChange({
                type: device.type,
                id: device.id,
                description: device.description,
              })
            }
          />
        ))}
      </View>
    );
  }

  return null;
}

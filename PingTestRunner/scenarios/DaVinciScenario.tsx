/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * DaVinciScenario — headless test screen for DaVinci E2E tests.
 *
 * Reads config from Detox launchArgs and renders a generic UI that handles all
 * collector types exposed by rn-davinci 2.0.1. Each collector gets a
 * deterministic testID of the form `davinci-field-{key}` so per-test files can
 * locate fields without knowing anything else about the form.
 *
 * testIDs:
 *   davinci-start-btn                       → starts the flow
 *   davinci-field-{key}                     → per-collector input
 *   davinci-field-{key}-option-{value}      → option button for single/multi-select
 *   davinci-flow-{key}                      → FLOW_BUTTON / FLOW_LINK / ACTION
 *   davinci-submit-btn                      → SUBMIT_BUTTON (or fallback submit)
 *   davinci-success                         → SuccessNode reached
 *   davinci-error                           → ErrorNode reached
 *   davinci-error-message                   → ErrorNode message
 *   davinci-failure                         → FailureNode reached
 *   davinci-failure-message                 → FailureNode message
 *   davinci-token-result                    → access token after success
 *   davinci-userinfo-btn / -result          → userinfo()
 *   davinci-refresh-btn / -refreshed        → refresh()
 *   davinci-revoke-btn / -revoked           → revoke()
 *   davinci-logout-btn / -logged-out        → logoutUser()
 *   davinci-loading                         → in-flight indicator
 *   davinci-runtime-error                   → unexpected runtime error
 */

import React, { useCallback, useState } from 'react';
import { Button, Switch, Text, TextInput, View } from 'react-native';
import { LaunchArguments } from 'react-native-launch-arguments';
import {
  createDaVinciClient,
  normalizeCollectors,
} from '@ping-identity/rn-davinci';
import type {
  DaVinciClient,
  DaVinciFormValue,
  DaVinciFormValues,
  DaVinciNextInput,
  DaVinciNode,
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

// ─── state ───────────────────────────────────────────────────────────────────

type ScenarioState = 'idle' | 'loading' | 'form' | 'success' | 'error';

export default function DaVinciScenario(): React.JSX.Element {
  const [state, setState] = useState<ScenarioState>('idle');
  const [client, setClient] = useState<DaVinciClient | null>(null);
  const [node, setNode] = useState<DaVinciNode | null>(null);
  const [values, setValues] = useState<DaVinciFormValues>({});
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [tokenResult, setTokenResult] = useState<string | null>(null);
  const [userinfo, setUserinfo] = useState<string | null>(null);
  const [refreshed, setRefreshed] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);

  const handleNode = useCallback(
    async (davinciClient: DaVinciClient, nextNode: DaVinciNode) => {
      setNode(nextNode);
      setValues({});
      if (nextNode.type === 'SuccessNode') {
        setState('success');
        try {
          const session = await davinciClient.user();
          if (session?.accessToken) {
            setTokenResult(session.accessToken);
          }
        } catch {
          // best effort
        }
        return;
      }
      if (nextNode.type === 'ContinueNode') {
        setState('form');
        return;
      }
      // ErrorNode / FailureNode
      setState('error');
    },
    [],
  );

  const handleStart = useCallback(async () => {
    setRuntimeError(null);
    setTokenResult(null);
    setUserinfo(null);
    setRefreshed(false);
    setRevoked(false);
    setLoggedOut(false);
    try {
      setState('loading');
      const davinciClient = createDaVinciClient({
        modules: {
          oidc: {
            discoveryEndpoint: DISCOVERY_ENDPOINT,
            clientId: CLIENT_ID,
            redirectUri: REDIRECT_URI,
            scopes: SCOPES,
          },
        },
        ...(TIMEOUT !== undefined ? { timeout: TIMEOUT } : {}),
      });
      setClient(davinciClient);
      const first = await davinciClient.start();
      await handleNode(davinciClient, first);
    } catch (e) {
      setRuntimeError(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  }, [handleNode]);

  const handleSubmit = useCallback(
    async (overrideInput?: DaVinciNextInput) => {
      if (!client || !node || node.type !== 'ContinueNode') {
        return;
      }
      try {
        setState('loading');
        const collectors = normalizeCollectors(node.collectors);
        const input = overrideInput ?? buildPayload(collectors, values);
        const nextNode = await client.next(input);
        await handleNode(client, nextNode);
      } catch (e) {
        setRuntimeError(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    },
    [client, node, values, handleNode],
  );

  const handleFlow = useCallback(
    async (flowKey: string) => {
      if (!node || node.type !== 'ContinueNode') return;
      const base = buildPayload(normalizeCollectors(node.collectors), values);
      await handleSubmit({
        collectors: [...base.collectors, { key: flowKey, value: flowKey }],
      });
    },
    [handleSubmit, node, values],
  );

  const handleUserinfo = useCallback(async () => {
    if (!client) return;
    try {
      const info = await client.userinfo();
      setUserinfo(JSON.stringify(info));
    } catch (e) {
      setRuntimeError(e instanceof Error ? e.message : String(e));
    }
  }, [client]);

  const handleRefresh = useCallback(async () => {
    if (!client) return;
    try {
      await client.refresh();
      setRefreshed(true);
    } catch (e) {
      setRuntimeError(e instanceof Error ? e.message : String(e));
    }
  }, [client]);

  const handleRevoke = useCallback(async () => {
    if (!client) return;
    try {
      await client.revoke();
      setRevoked(true);
    } catch (e) {
      setRuntimeError(e instanceof Error ? e.message : String(e));
    }
  }, [client]);

  const handleLogout = useCallback(async () => {
    if (!client) return;
    try {
      await client.logoutUser();
      setLoggedOut(true);
    } catch (e) {
      setRuntimeError(e instanceof Error ? e.message : String(e));
    }
  }, [client]);

  return (
    <View>
      <Button testID="davinci-start-btn" title="Start" onPress={handleStart} />

      {state === 'loading' && <Text testID="davinci-loading">Loading…</Text>}

      {state === 'form' && node?.type === 'ContinueNode' && (
        <ContinueNodeForm
          collectors={normalizeCollectors(node.collectors)}
          values={values}
          onChange={setValues}
          onSubmit={() => handleSubmit()}
          onFlow={handleFlow}
        />
      )}

      {state === 'success' && (
        <View>
          <Text testID="davinci-success">Success</Text>
          {tokenResult !== null && (
            <Text
              testID="davinci-token-result"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {tokenResult}
            </Text>
          )}
          <Button
            testID="davinci-userinfo-btn"
            title="User Info"
            onPress={handleUserinfo}
          />
          {userinfo !== null && (
            <Text
              testID="davinci-userinfo-result"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {userinfo}
            </Text>
          )}
          <Button
            testID="davinci-refresh-btn"
            title="Refresh"
            onPress={handleRefresh}
          />
          {refreshed && <Text testID="davinci-refreshed">Refreshed</Text>}
          <Button
            testID="davinci-revoke-btn"
            title="Revoke"
            onPress={handleRevoke}
          />
          {revoked && <Text testID="davinci-revoked">Revoked</Text>}
          <Button
            testID="davinci-logout-btn"
            title="Logout"
            onPress={handleLogout}
          />
          {loggedOut && <Text testID="davinci-logged-out">Logged out</Text>}
        </View>
      )}

      {state === 'error' && node?.type === 'ErrorNode' && (
        <View>
          <Text testID="davinci-error">Error</Text>
          <Text testID="davinci-error-message">{node.message}</Text>
        </View>
      )}

      {state === 'error' && node?.type === 'FailureNode' && (
        <View>
          <Text testID="davinci-failure">Failure</Text>
          <Text testID="davinci-failure-message">{node.message}</Text>
        </View>
      )}

      {runtimeError !== null && (
        <Text testID="davinci-runtime-error">{runtimeError}</Text>
      )}
    </View>
  );
}

// ─── ContinueNodeForm ────────────────────────────────────────────────────────

interface ContinueNodeFormProps {
  collectors: DaVinciNormalizedCollector[];
  values: DaVinciFormValues;
  onChange: (values: DaVinciFormValues) => void;
  onSubmit: () => void;
  onFlow: (flowKey: string) => void;
}

function ContinueNodeForm({
  collectors,
  values,
  onChange,
  onSubmit,
  onFlow,
}: ContinueNodeFormProps): React.JSX.Element {
  const hasSubmitButton = collectors.some((c) => c.type === 'SUBMIT_BUTTON');

  return (
    <View>
      {collectors.map((collector) => (
        <CollectorField
          key={collector.key}
          collector={collector}
          value={values[collector.key]}
          onValueChange={(val) => onChange({ ...values, [collector.key]: val })}
          onFlow={onFlow}
          onSubmit={onSubmit}
        />
      ))}
      {!hasSubmitButton && (
        <Button testID="davinci-submit-btn" title="Submit" onPress={onSubmit} />
      )}
    </View>
  );
}

// ─── CollectorField ──────────────────────────────────────────────────────────

interface CollectorFieldProps {
  collector: DaVinciNormalizedCollector;
  value: DaVinciFormValue | undefined;
  onValueChange: (val: DaVinciFormValue) => void;
  onFlow: (flowKey: string) => void;
  onSubmit: () => void;
}

function CollectorField({
  collector,
  value,
  onValueChange,
  onFlow,
  onSubmit,
}: CollectorFieldProps): React.JSX.Element | null {
  const testID = `davinci-field-${collector.key}`;

  if (collector.type === 'LABEL') {
    return (
      <Text testID={`davinci-label-${collector.key}`}>{collector.content}</Text>
    );
  }

  if (collector.type === 'SUBMIT_BUTTON') {
    return (
      <Button
        testID="davinci-submit-btn"
        title={collector.label || 'Submit'}
        onPress={onSubmit}
      />
    );
  }

  if (
    collector.type === 'ACTION' ||
    collector.type === 'FLOW_BUTTON' ||
    collector.type === 'FLOW_LINK'
  ) {
    return (
      <Button
        testID={`davinci-flow-${collector.key}`}
        title={collector.label || collector.key}
        onPress={() => onFlow(collector.key)}
      />
    );
  }

  if (collector.type === 'TEXT') {
    return (
      <TextInput
        testID={testID}
        value={typeof value === 'string' ? value : ''}
        onChangeText={onValueChange}
        placeholder={collector.label}
      />
    );
  }

  if (collector.type === 'PASSWORD' || collector.type === 'PASSWORD_VERIFY') {
    return (
      <TextInput
        testID={testID}
        secureTextEntry
        value={typeof value === 'string' ? value : ''}
        onChangeText={onValueChange}
        placeholder={collector.label}
      />
    );
  }

  if (
    collector.type === 'SINGLE_SELECT' ||
    collector.type === 'DROPDOWN' ||
    collector.type === 'RADIO'
  ) {
    return (
      <View testID={testID}>
        {collector.options.map((opt) => (
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

  if (
    collector.type === 'MULTI_SELECT' ||
    collector.type === 'COMBOBOX' ||
    collector.type === 'CHECKBOX'
  ) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <View testID={testID}>
        {collector.options.map((opt) => {
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

  if (collector.type === 'PHONE_NUMBER') {
    const phone =
      (value as { countryCode?: string; phoneNumber?: string } | undefined) ??
      {};
    return (
      <View testID={testID}>
        <TextInput
          testID={`${testID}-country-code`}
          value={phone.countryCode ?? collector.countryCode ?? ''}
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
              countryCode: phone.countryCode ?? collector.countryCode ?? '',
              phoneNumber: t,
            })
          }
          placeholder="Phone number"
        />
      </View>
    );
  }

  if (collector.type === 'DEVICE_REGISTRATION') {
    return (
      <View testID={testID}>
        {collector.devices.map((device) => (
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

  if (collector.type === 'DEVICE_AUTHENTICATION') {
    return (
      <View testID={testID}>
        {collector.devices.map((device) => (
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

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds a raw next-input payload from collectors + form values without using
 * the helper, mirroring the manual flow a sample app would write directly.
 *
 * @param collectors - Normalised collectors for the current form.
 * @param values - Current form values keyed by collector key.
 * @returns Bridge-ready next-input payload.
 */
function buildPayload(
  collectors: DaVinciNormalizedCollector[],
  values: DaVinciFormValues,
): DaVinciNextInput {
  const out: Array<{ key: string; value: unknown }> = [];
  collectors.forEach((collector) => {
    if (collector.type === 'LABEL') return;
    if (
      collector.type === 'ACTION' ||
      collector.type === 'FLOW_BUTTON' ||
      collector.type === 'FLOW_LINK'
    ) {
      return;
    }
    if (collector.type === 'SUBMIT_BUTTON') {
      out.push({ key: collector.key, value: collector.key });
      return;
    }
    const value = values[collector.key];
    if (value === undefined) return;
    out.push({ key: collector.key, value });
  });
  return { collectors: out };
}

/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useState } from 'react';
import { ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import Keyless, {
  SetupConfig,
  BiomAuthConfig,
  BiomEnrollConfig,
  BiomDeEnrollConfig,
  ClientStateType,
} from '@react-native-keyless/sdk';
import type { KeylessResult } from '@react-native-keyless/sdk';
import { useJourney } from '@ping-identity/rn-journey';
import type {
  JourneyCallback,
  JourneyCallbackInput,
  JourneyClient,
} from '@ping-identity/rn-journey';
import { callbackType } from '@ping-identity/rn-types';
import PingTextInput from './components/atoms/PingTextInput';
import PayloadViewer from './components/atoms/PayloadViewer';
import { commonStyles } from '../src/styles/common';
import { journeyFullScreenStyles as journeyStyles } from '../src/styles/journeyStyles';
import { formatError } from './utils/formatError';

const RECOGNIZE_CALLBACK_TYPE = 'PingOneRecognizeCallback';
const DEFAULT_JOURNEY_NAME = 'RecognizeAuthenticate';

/**
 * Keyless outcome marshalled for the native positional input() write-back, in
 * the server-documented field order.
 */
type RecognizeRunOutcome = {
  signedJwt: string;
  clientState: string;
  recognizeId: string;
  devicePublicSigningKey: string;
  clientError: string;
  clientErrorCode: string;
};

/**
 * Raw server output fields of a PingOneRecognizeCallback, read from the
 * unknown-callback payload via `raw.output`.
 */
type RecognizeServerFields = {
  apiKey: string;
  host: string;
  operationType: string;
  clientState: string;
  transactionData: string;
  audience: string;
  generateClientState: string;
  inputNames: string[];
  inputOriginalValues: string[];
};

function readServerFields(
  callback: JourneyCallback,
): RecognizeServerFields | null {
  const raw = (callback as Record<string, unknown>).raw as
    | {
        output?: Array<{ name?: string; value?: unknown }>;
        input?: Array<{ name?: string; value?: unknown }>;
      }
    | undefined;
  const output = raw?.output;
  if (!Array.isArray(output)) {
    return null;
  }
  const read = (name: string): string => {
    const entry = output.find(item => item.name === name);
    const value = entry?.value;
    return typeof value === 'string' ? value : '';
  };
  // The server sends generateClientState as a boolean.
  const generateClientStateRaw = output.find(
    item => item.name === 'generateClientState',
  )?.value;
  const generateClientState =
    generateClientStateRaw === true ||
    (typeof generateClientStateRaw === 'string' &&
      generateClientStateRaw.toLowerCase() === 'true');
  return {
    apiKey: read('apiKey'),
    host: read('host'),
    operationType: read('operationType'),
    clientState: read('clientState'),
    transactionData: read('transactionData'),
    audience: read('audience'),
    generateClientState: generateClientState ? 'true' : '',
    inputNames: (raw?.input ?? []).map(item => item.name ?? ''),
    inputOriginalValues: (raw?.input ?? []).map(item =>
      typeof item.value === 'string' ? item.value : '',
    ),
  };
}

type Props = {
  /**
   * Journey client selected by the sample app configuration.
   */
  journeyClient: JourneyClient;
};

/**
 * Proof-of-concept screen for assessment Option 1: a React Native adapter
 * that drives the Keyless React Native SDK directly from JavaScript and
 * reproduces the Journey glue that the native Ping Recognize modules
 * provide out of the box under Option 2.
 *
 * @param props - Screen props.
 * @returns Option 1 Recognize POC screen element.
 */
export default function RecognizeOption1PocScreen({
  journeyClient,
}: Props): React.ReactElement {
  const [node, actions] = useJourney(journeyClient);
  const [journeyName, setJourneyName] = useState(DEFAULT_JOURNEY_NAME);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [logLines, setLogLines] = useState<string[]>([]);

  const log = (line: string): void => {
    console.log(`[opt1] ${line}`);
    setLogLines(previous => [...previous, line]);
    fetch('http://127.0.0.1:8765', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line: `[opt1] ${line}` }),
    }).catch(() => {});
  };

  const callbacks = node?.callbacks ?? [];
  const hasName = callbacks.some(cb => cb.type === callbackType.NameCallback);
  const hasPassword = callbacks.some(
    cb => cb.type === callbackType.PasswordCallback,
  );
  const recognizeCallbacks = callbacks.filter(
    cb => (cb.type as string) === RECOGNIZE_CALLBACK_TYPE,
  );

  const onStart = async (): Promise<void> => {
    setLogLines([]);
    try {
      const started = await actions.start(journeyName.trim());
      log(`start -> ${started.type ?? 'unknown'}`);
    } catch (error) {
      log(`start failed: ${formatError(error)}`);
    }
  };

  const toFailure = (result: KeylessResult<unknown>): string => {
    if (result.isFailure()) {
      return JSON.stringify({
        code: result.error.code,
        message: result.error.message ?? '',
      });
    }
    return '{}';
  };

  // Manual shortcuts for driving Keyless state outside a Journey run.
  const ensureConfigured = async (
    fields: RecognizeServerFields | null,
  ): Promise<boolean> => {
    if (!fields || !fields.apiKey || !fields.host) {
      log(
        'shortcut needs a cached Recognize callback (run a journey once first)',
      );
      return false;
    }
    const configured = await Keyless.configure(
      new SetupConfig({ apiKey: fields.apiKey, hosts: [fields.host] }),
    );
    if (!configured.isSuccess()) {
      log(`configure failed -> ${toFailure(configured)}`);
      return false;
    }
    return true;
  };

  const onShortcutEnroll = async (): Promise<void> => {
    try {
      const fields = readServerFields(recognizeCallbacks[0]);
      if (!(await ensureConfigured(fields))) {
        return;
      }
      const result = await Keyless.enroll(new BiomEnrollConfig());
      log(
        result.isSuccess()
          ? `shortcut enroll success -> keylessId=${result.data.keylessId}`
          : `shortcut enroll failed -> ${toFailure(result)}`,
      );
    } catch (error) {
      log(`shortcut enroll threw -> ${formatError(error)}`);
    }
  };

  const onShortcutAuthenticate = async (): Promise<void> => {
    try {
      const fields = readServerFields(recognizeCallbacks[0]);
      if (!(await ensureConfigured(fields))) {
        return;
      }
      const result = await Keyless.authenticate(new BiomAuthConfig());
      log(
        result.isSuccess()
          ? `shortcut authenticate success -> signedJwt?${Boolean(result.data.signedJwt)}`
          : `shortcut authenticate failed -> ${toFailure(result)}`,
      );
    } catch (error) {
      log(`shortcut authenticate threw -> ${formatError(error)}`);
    }
  };

  const onShortcutDeEnroll = async (): Promise<void> => {
    try {
      const fields = readServerFields(recognizeCallbacks[0]);
      if (!(await ensureConfigured(fields))) {
        return;
      }
      const result = await Keyless.deEnroll(new BiomDeEnrollConfig());
      log(
        result.isSuccess()
          ? 'shortcut de-enroll success'
          : `shortcut de-enroll failed -> ${toFailure(result)}`,
      );
    } catch (error) {
      log(`shortcut de-enroll threw -> ${formatError(error)}`);
    }
  };

  const onShortcutValidate = async (): Promise<void> => {
    try {
      const fields = readServerFields(recognizeCallbacks[0]);
      if (!(await ensureConfigured(fields))) {
        return;
      }
      const result = await Keyless.validateUserAndDeviceActive();
      log(
        result.isSuccess()
          ? 'shortcut validate -> user and device active (enrolled)'
          : `shortcut validate failed -> ${toFailure(result)}`,
      );
    } catch (error) {
      log(`shortcut validate threw -> ${formatError(error)}`);
    }
  };

  const emptyResult = (
    clientError: string,
    clientErrorCode: string,
  ): RecognizeRunOutcome => ({
    signedJwt: '',
    clientState: '',
    recognizeId: '',
    devicePublicSigningKey: '',
    clientError,
    clientErrorCode,
  });

  const signingKey = async (): Promise<string> => {
    const result = await Keyless.getDevicePublicSigningKey();
    if (result.isSuccess()) {
      return result.data;
    }
    log(`signing key retrieval failed -> ${toFailure(result)}`);
    return '';
  };

  const runRecognizeForIndex = async (
    index: number,
  ): Promise<RecognizeRunOutcome> => {
    const fields = readServerFields(recognizeCallbacks[index]);
    if (!fields) {
      log(`recognize[${index}] -> no raw output fields found on callback`);
      return emptyResult('no server fields on callback', '1000');
    }
    log(
      `recognize[${index}] server fields: operationType=${fields.operationType} input=[${fields.inputNames.join(', ')}]`,
    );

    const configured = await Keyless.configure(
      new SetupConfig({ apiKey: fields.apiKey, hosts: [fields.host] }),
    );
    if (!configured.isSuccess()) {
      log(`recognize[${index}] configure failed -> ${toFailure(configured)}`);
      return emptyResult(
        configured.isFailure() ? (configured.error.message ?? '') : '',
        configured.isFailure() ? String(configured.error.code) : '1000',
      );
    }

    const jwtSigningInfo = fields.transactionData
      ? {
          claimTransactionData: fields.transactionData,
          audience: fields.audience || undefined,
        }
      : undefined;

    if (fields.operationType === 'AUTHENTICATE') {
      // Keyless has no clientState on BiomAuthConfig, so a stale enrollment
      // cannot take the server's restore path. De-enroll and re-enroll, then
      // authenticate — reproducing by hand what the Ping native module does
      // automatically.
      const first = await Keyless.authenticate(
        new BiomAuthConfig({ jwtSigningInfo }),
      );
      if (first.isSuccess()) {
        log(
          `recognize[${index}] authenticate success -> signedJwt?${Boolean(first.data.signedJwt)} clientState?${Boolean(first.data.clientState)}`,
        );
        return {
          signedJwt: first.data.signedJwt ?? '',
          clientState: first.data.clientState ?? '',
          recognizeId: '',
          devicePublicSigningKey: await signingKey(),
          clientError: '',
          clientErrorCode: '',
        };
      }
      log(`recognize[${index}] authenticate failed -> ${toFailure(first)}`);
      log(
        `recognize[${index}] falling back: de-enroll + enroll + authenticate (manual restore path)`,
      );
      const deEnrolled = await Keyless.deEnroll(new BiomDeEnrollConfig());
      if (!deEnrolled.isSuccess()) {
        log(`recognize[${index}] de-enroll failed -> ${toFailure(deEnrolled)}`);
        return emptyResult(
          deEnrolled.isFailure() ? (deEnrolled.error.message ?? '') : '',
          deEnrolled.isFailure() ? String(deEnrolled.error.code) : '1000',
        );
      }
      const reEnrolled = await Keyless.enroll(
        new BiomEnrollConfig({
          jwtSigningInfo,
          clientState: fields.clientState || undefined,
        }),
      );
      if (!reEnrolled.isSuccess()) {
        log(`recognize[${index}] re-enroll failed -> ${toFailure(reEnrolled)}`);
        return emptyResult(
          reEnrolled.isFailure() ? (reEnrolled.error.message ?? '') : '',
          reEnrolled.isFailure() ? String(reEnrolled.error.code) : '1000',
        );
      }
      log(
        `recognize[${index}] re-enroll success -> keylessId=${reEnrolled.data.keylessId}`,
      );
      const retried = await Keyless.authenticate(
        new BiomAuthConfig({ jwtSigningInfo }),
      );
      if (retried.isSuccess()) {
        log(
          `recognize[${index}] authenticate success (after restore) -> signedJwt?${Boolean(retried.data.signedJwt)}`,
        );
        return {
          signedJwt: retried.data.signedJwt ?? '',
          clientState: retried.data.clientState ?? '',
          recognizeId: reEnrolled.data.keylessId,
          devicePublicSigningKey: await signingKey(),
          clientError: '',
          clientErrorCode: '',
        };
      }
      log(`recognize[${index}] authenticate failed -> ${toFailure(retried)}`);
      return emptyResult(
        retried.isFailure() ? (retried.error.message ?? '') : '',
        retried.isFailure() ? String(retried.error.code) : '1000',
      );
    }

    // Server wants ENROLL. If the device holds a stale enrollment, Keyless
    // rejects with 20001 — de-enroll first, mirroring the native module's
    // reconciliation.
    let result = await Keyless.enroll(
      new BiomEnrollConfig({
        jwtSigningInfo,
        clientState: fields.clientState || undefined,
        generatingClientState:
          fields.generateClientState === 'true'
            ? ClientStateType.BACKUP
            : undefined,
      }),
    );
    if (
      !result.isSuccess() &&
      result.isFailure() &&
      result.error.code === 20001
    ) {
      log(
        `recognize[${index}] enroll rejected (20001 already enrolled) -> de-enrolling first`,
      );
      const deEnrolled = await Keyless.deEnroll(new BiomDeEnrollConfig());
      if (!deEnrolled.isSuccess()) {
        log(`recognize[${index}] de-enroll failed -> ${toFailure(deEnrolled)}`);
        return emptyResult(
          deEnrolled.isFailure() ? (deEnrolled.error.message ?? '') : '',
          deEnrolled.isFailure() ? String(deEnrolled.error.code) : '1000',
        );
      }
      result = await Keyless.enroll(
        new BiomEnrollConfig({
          jwtSigningInfo,
          clientState: fields.clientState || undefined,
          generatingClientState:
            fields.generateClientState === 'true'
              ? ClientStateType.BACKUP
              : undefined,
        }),
      );
    }
    if (result.isSuccess()) {
      log(
        `recognize[${index}] enroll success -> keylessId=${result.data.keylessId} signedJwt?${Boolean(result.data.signedJwt)} clientState?${Boolean(result.data.clientState)}`,
      );
      return {
        signedJwt: result.data.signedJwt ?? '',
        clientState: result.data.clientState ?? '',
        recognizeId: result.data.keylessId,
        devicePublicSigningKey: await signingKey(),
        clientError: '',
        clientErrorCode: '',
      };
    }
    log(`recognize[${index}] enroll failed -> ${toFailure(result)}`);
    return emptyResult(
      result.isFailure() ? (result.error.message ?? '') : '',
      result.isFailure() ? String(result.error.code) : '1000',
    );
  };

  const onLogout = async (): Promise<void> => {
    try {
      await actions.logoutUser();
      log('logout -> session cleared');
    } catch (error) {
      log(`logout failed: ${formatError(error)}`);
    }
  };

  const onCopyLog = async (): Promise<void> => {
    const payload = logLines.join('\n');
    try {
      await Share.share({ message: payload });
    } catch {
      // Share sheet cancelled or unavailable — nothing to report.
    }
  };

  const onContinue = async (): Promise<void> => {
    try {
      // Positional write-back slots are derived per callback from its server
      // input names (see the write-back block below).
      const recognizeResults: Array<{
        signedJwt: string;
        clientState: string;
        recognizeId: string;
        devicePublicSigningKey: string;
        clientError: string;
        clientErrorCode: string;
      }> = [];

      if (recognizeCallbacks.length > 0) {
        for (let index = 0; index < recognizeCallbacks.length; index += 1) {
          try {
            recognizeResults.push(await runRecognizeForIndex(index));
          } catch (error) {
            log(`recognize[${index}] threw -> ${formatError(error)}`);
            recognizeResults.push({
              signedJwt: '',
              clientState: '',
              recognizeId: '',
              devicePublicSigningKey: '',
              clientError: formatError(error),
              clientErrorCode: '1000',
            });
          }
        }
        log(
          'WRITE-BACK: submitting Keyless results through the rn-journey ' +
            'generic input() branch (POC-native-change experiment).',
        );
      }

      const inputs: JourneyCallbackInput[] = [];
      if (hasName) {
        inputs.push({ type: callbackType.NameCallback, value: username });
      }
      if (hasPassword) {
        inputs.push({ type: callbackType.PasswordCallback, value: password });
      }
      recognizeCallbacks.forEach((callback, index) => {
        const result = recognizeResults[index];
        if (result) {
          // Mirror the iOS native module's semantics: write only non-empty
          // values, leave every other slot with the server's original value.
          // Positional input() replaces the whole array, so a skipped slot is
          // represented by resubmitting its original value.
          const fields = readServerFields(callback);
          const byName: Record<string, string> = {
            IDToken1signedJwt: result.signedJwt,
            IDToken1clientState: result.clientState,
            IDToken1recognizeId: result.recognizeId,
            IDToken1devicePublicSigningKey: result.devicePublicSigningKey,
            IDToken1clientError: result.clientError,
            IDToken1clientErrorCode: result.clientErrorCode,
          };
          const slotNames = fields?.inputNames.length
            ? fields.inputNames
            : [
                'IDToken1signedJwt',
                'IDToken1clientState',
                'IDToken1recognizeId',
                'IDToken1devicePublicSigningKey',
                'IDToken1clientError',
                'IDToken1clientErrorCode',
              ];
          const originalValues = fields?.inputOriginalValues ?? [];
          const values = slotNames.map((name, slotIndex) => {
            const submitted = byName[name] ?? '';
            return submitted !== ''
              ? submitted
              : (originalValues[slotIndex] ?? '');
          });
          log(
            `recognize[${index}] write-back slots: ${slotNames
              .map(name => {
                const submitted = byName[name] ?? '';
                return submitted !== '' ? `${name}=<new>` : `${name}=<kept>`;
              })
              .join(', ')}`,
          );
          inputs.push({
            type: RECOGNIZE_CALLBACK_TYPE as never,
            value: values,
            index,
          });
        }
      });

      const next = await actions.next({ callbacks: inputs });
      log(`next -> ${next.type ?? 'unknown'}`);
    } catch (error) {
      log(`continue failed: ${formatError(error)}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      <View style={[journeyStyles.section, commonStyles.homeList]}>
        <PingTextInput
          label="Journey name"
          value={journeyName}
          onChangeText={setJourneyName}
          placeholder="Journey name"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={commonStyles.buttonPrimary}
          testID="recognize-option1-poc-start"
          onPress={() => onStart()}
          disabled={actions.loading}
        >
          <Text style={commonStyles.buttonText}>Start</Text>
        </TouchableOpacity>
        <View style={commonStyles.buttonGrid}>
          <TouchableOpacity
            style={commonStyles.buttonSecondary}
            testID="recognize-option1-journey-enrollment"
            onPress={() => setJourneyName('RecognizeEnrollment')}
          >
            <Text style={commonStyles.buttonTextSecondary}>Enrollment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={commonStyles.buttonSecondary}
            testID="recognize-option1-journey-authenticate"
            onPress={() => setJourneyName('RecognizeAuthenticate')}
          >
            <Text style={commonStyles.buttonTextSecondary}>Authenticate</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={commonStyles.buttonSecondary}
            testID="recognize-option1-journey-deenroll"
            onPress={() => setJourneyName('RecognizeDeenroll')}
          >
            <Text style={commonStyles.buttonTextSecondary}>De-enroll</Text>
          </TouchableOpacity>
        </View>
      </View>

      {node?.type === 'ContinueNode' ? (
        <View style={[journeyStyles.section, commonStyles.homeList]}>
          <Text style={journeyStyles.nodeHeader}>Node: ContinueNode</Text>
          <Text style={journeyStyles.callbackType}>
            Callbacks: {callbacks.map(cb => cb.type as string).join(', ')}
          </Text>
          {recognizeCallbacks.length > 0 ? (
            <Text style={journeyStyles.integrationText}>
              {RECOGNIZE_CALLBACK_TYPE} × {recognizeCallbacks.length} — Option
              1: the adapter calls the Keyless SDK directly from JS.
            </Text>
          ) : null}
          {hasName ? (
            <PingTextInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              autoCapitalize="none"
            />
          ) : null}
          {hasPassword ? (
            <PingTextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              allowPasswordToggle
            />
          ) : null}
          <TouchableOpacity
            style={commonStyles.buttonPrimary}
            testID="recognize-option1-poc-continue"
            onPress={onContinue}
            disabled={actions.loading}
          >
            <Text style={commonStyles.buttonText}>
              {recognizeCallbacks.length > 0
                ? 'Run Keyless (Option 1) and continue'
                : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {node?.type && node.type !== 'ContinueNode' ? (
        <View style={[journeyStyles.section, commonStyles.homeList]}>
          <Text
            style={journeyStyles.nodeHeader}
            testID="recognize-option1-poc-terminal"
          >
            Node: {node.type}
          </Text>
          {node.message ? (
            <Text style={journeyStyles.nodeDescription}>{node.message}</Text>
          ) : null}
          {node.type === 'SuccessNode' ? (
            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              testID="recognize-option1-poc-logout"
              onPress={onLogout}
              disabled={actions.loading}
            >
              <Text style={commonStyles.buttonTextSecondary}>Logout</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={[journeyStyles.section, commonStyles.homeList]}>
        <Text style={journeyStyles.callbackLabel}>Keyless shortcuts</Text>
        <View style={commonStyles.buttonGrid}>
          <TouchableOpacity
            style={commonStyles.buttonSecondary}
            testID="recognize-option1-shortcut-enroll"
            onPress={onShortcutEnroll}
          >
            <Text style={commonStyles.buttonTextSecondary}>Enroll</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={commonStyles.buttonSecondary}
            testID="recognize-option1-shortcut-authenticate"
            onPress={onShortcutAuthenticate}
          >
            <Text style={commonStyles.buttonTextSecondary}>Authenticate</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={commonStyles.buttonSecondary}
            testID="recognize-option1-shortcut-deenroll"
            onPress={onShortcutDeEnroll}
          >
            <Text style={commonStyles.buttonTextSecondary}>De-enroll</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={commonStyles.buttonSecondary}
            testID="recognize-option1-shortcut-validate"
            onPress={onShortcutValidate}
          >
            <Text style={commonStyles.buttonTextSecondary}>Validate</Text>
          </TouchableOpacity>
        </View>
        <Text style={journeyStyles.integrationText}>
          Shortcuts reuse the apiKey/host from the last Recognize callback in
          this session. Start a journey once to enable them.
        </Text>
      </View>

      <View style={[journeyStyles.section, commonStyles.homeList]}>
        <View style={commonStyles.buttonGrid}>
          <Text style={journeyStyles.callbackLabel}>Log</Text>
          {logLines.length > 0 ? (
            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              testID="recognize-option1-poc-copy-log"
              onPress={onCopyLog}
            >
              <Text style={commonStyles.buttonTextSecondary}>Copy log</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {logLines.length > 0 ? (
          <PayloadViewer payload={logLines.join('\n')} />
        ) : (
          <Text style={journeyStyles.integrationText}>
            No activity yet. Start the journey to begin.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

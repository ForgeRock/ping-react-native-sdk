/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useJourney } from '@ping-identity/rn-journey';
import type {
  JourneyCallbackInput,
  JourneyClient,
} from '@ping-identity/rn-journey';
import { callbackType } from '@ping-identity/rn-types';
import {
  buildVendorSubmitInput,
  createRecognizeExecutor,
} from '../src/recognizeExecutor';
import PingTextInput from './components/atoms/PingTextInput';
import PayloadViewer from './components/atoms/PayloadViewer';
import { commonStyles } from '../src/styles/common';
import { journeyFullScreenStyles as journeyStyles } from '../src/styles/journeyStyles';
import { formatError } from './utils/formatError';

const RECOGNIZE_CALLBACK_TYPE = 'PingOneRecognizeCallback';
const DEFAULT_JOURNEY_NAME = 'RecognizeAuthenticate';

type Props = {
  /**
   * Journey client selected by the sample app configuration.
   */
  journeyClient: JourneyClient;
};

/**
 * Proof-of-concept screen that runs a Journey containing a PingOne Recognize
 * node using `@ping-identity/rn-recognize`.
 *
 * @param props - Screen props.
 * @returns Recognize POC screen element.
 */
export default function RecognizePocScreen({
  journeyClient,
}: Props): React.ReactElement {
  const [node, actions] = useJourney(journeyClient);
  const [journeyName, setJourneyName] = useState(DEFAULT_JOURNEY_NAME);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [logLines, setLogLines] = useState<string[]>([]);

  const executor = useMemo(() => {
    try {
      return createRecognizeExecutor();
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
  }, []);

  const providerBadge =
    executor instanceof Error
      ? `Recognize provider: unavailable (${executor.message})`
      : `Recognize provider: ${executor.provider}`;

  const log = (line: string): void => {
    setLogLines(previous => [...previous, line]);
  };

  const callbacks = node?.callbacks ?? [];
  const hasName = callbacks.some(cb => cb.type === callbackType.NameCallback);
  const hasPassword = callbacks.some(
    cb => cb.type === callbackType.PasswordCallback,
  );
  const recognizeCount = callbacks.filter(
    cb => (cb.type as string) === RECOGNIZE_CALLBACK_TYPE,
  ).length;

  const onStart = async (): Promise<void> => {
    setLogLines([]);
    try {
      const started = await actions.start(journeyName.trim());
      log(`start -> ${started.type ?? 'unknown'}`);
    } catch (error) {
      log(`start failed: ${formatError(error)}`);
    }
  };

  const onLogout = async (): Promise<void> => {
    try {
      await actions.logoutUser();
      log('logout -> session cleared');
    } catch (error) {
      log(`logout failed: ${formatError(error)}`);
    }
  };

  const onContinue = async (): Promise<void> => {
    try {
      const vendorInputs: JourneyCallbackInput[] = [];
      if (recognizeCount > 0) {
        if (executor instanceof Error) {
          log(`recognize unavailable: ${executor.message}`);
          return;
        }
        log(`provider: ${executor.provider}`);
        for (let index = 0; index < recognizeCount; index += 1) {
          const result = await executor.runForJourney(
            journeyClient,
            { index },
            callbacks as never,
          );
          log(`recognize[${index}] -> ${JSON.stringify(result)}`);
          if (executor.provider === 'keyless-vendor') {
            // Vendor mode: the ceremony outcome must be written into the
            // callback by the caller (the native bridge does not write back).
            const callback = (callbacks as never[])[index] as never;
            const submit = buildVendorSubmitInput(
              callback,
              // Failure results still submit their error fields so the server
              // can branch; map the failure shape onto the vendor outcome.
              {
                signedJwt: result.type === 'success' ? '' : '',
                clientState: '',
                recognizeId:
                  result.type === 'success' ? result.recognizeId : '',
                devicePublicSigningKey: '',
                clientError: result.type === 'failure' ? result.message : '',
                clientErrorCode: result.type === 'failure' ? result.code : '',
              },
              index,
            );
            log(`write-back slots -> ${JSON.stringify(submit.value)}`);
            vendorInputs.push(submit as JourneyCallbackInput);
          }
        }
      }

      const inputs: JourneyCallbackInput[] = [];
      if (hasName) {
        inputs.push({ type: callbackType.NameCallback, value: username });
      }
      if (hasPassword) {
        inputs.push({ type: callbackType.PasswordCallback, value: password });
      }
      inputs.push(...vendorInputs.splice(0));

      const next = await actions.next({ callbacks: inputs });
      log(`next -> ${next.type ?? 'unknown'}`);
    } catch (error) {
      log(`continue failed: ${formatError(error)}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      <View style={[journeyStyles.section, commonStyles.homeList]}>
        <Text style={journeyStyles.integrationText}>{providerBadge}</Text>
        <PingTextInput
          label="Journey name"
          value={journeyName}
          onChangeText={setJourneyName}
          placeholder="Journey name"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={commonStyles.buttonPrimary}
          testID="recognize-poc-start"
          onPress={onStart}
          disabled={actions.loading}
        >
          <Text style={commonStyles.buttonText}>Start</Text>
        </TouchableOpacity>
      </View>

      {node?.type === 'ContinueNode' ? (
        <View style={[journeyStyles.section, commonStyles.homeList]}>
          <Text style={journeyStyles.nodeHeader}>Node: ContinueNode</Text>
          <Text style={journeyStyles.callbackType}>
            Callbacks: {callbacks.map(cb => cb.type as string).join(', ')}
          </Text>
          {recognizeCount > 0 ? (
            <Text style={journeyStyles.integrationText}>
              {RECOGNIZE_CALLBACK_TYPE} × {recognizeCount} — Run Recognize
              handles the biometric ceremony natively.
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
            testID="recognize-poc-continue"
            onPress={onContinue}
            disabled={actions.loading}
          >
            <Text style={commonStyles.buttonText}>
              {recognizeCount > 0 ? 'Run Recognize and continue' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {node?.type && node.type !== 'ContinueNode' ? (
        <View style={[journeyStyles.section, commonStyles.homeList]}>
          <Text
            style={journeyStyles.nodeHeader}
            testID="recognize-poc-terminal"
          >
            Node: {node.type}
          </Text>
          {node.message ? (
            <Text style={journeyStyles.nodeDescription}>{node.message}</Text>
          ) : null}
          {node.type === 'SuccessNode' ? (
            <TouchableOpacity
              style={commonStyles.buttonSecondary}
              testID="recognize-poc-logout"
              onPress={onLogout}
              disabled={actions.loading}
            >
              <Text style={commonStyles.buttonTextSecondary}>Logout</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={[journeyStyles.section, commonStyles.homeList]}>
        <Text style={journeyStyles.callbackLabel}>Log</Text>
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

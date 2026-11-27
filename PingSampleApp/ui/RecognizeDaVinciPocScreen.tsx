/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  DaVinciProvider,
  useDaVinci,
  useDaVinciContext,
  useDaVinciForm,
} from '@ping-identity/rn-davinci';
import type { RecognizeResult } from '@ping-identity/rn-recognize';
import { createRecognizeExecutor } from '../src/recognizeExecutor';
import { commonStyles } from '../src/styles/common';
import { formatError } from './utils/formatError';

type Props = {
  /**
   * DaVinci client configuration from the sample app client factory.
   */
  config: unknown;
};

/**
 * Runs a DaVinci flow and executes the Android-only `RECOGNIZE` collector
 * through the native Recognize collector when the node pauses on one.
 *
 * @param props Screen props carrying the DaVinci client configuration.
 * @returns DaVinci Recognize POC screen element.
 */
export default function RecognizeDaVinciPocScreen({
  config,
}: Props): React.ReactElement {
  return (
    <DaVinciProvider config={config as never}>
      <RecognizeDaVinciPocPanel />
    </DaVinciProvider>
  );
}

function RecognizeDaVinciPocPanel(): React.ReactElement {
  const davinciContext = useDaVinciContext();
  const { node, loading, error, start, next } = useDaVinci();
  const [logLines, setLogLines] = useState<string[]>([]);

  const executor = useMemo(() => {
    try {
      return createRecognizeExecutor();
    } catch (caught) {
      return caught instanceof Error ? caught : new Error(String(caught));
    }
  }, []);

  const providerBadge =
    executor instanceof Error
      ? `Recognize provider: unavailable (${executor.message})`
      : `Recognize provider: ${executor.provider}`;

  const log = (line: string): void => {
    setLogLines(previous => [...previous, line]);
  };

  const form = useDaVinciForm(node, {
    handledCollectorTypes: new Set(['RECOGNIZE']),
  });

  const recognizeCollectors = useMemo(
    () => form.fields.filter(field => field.type === 'RECOGNIZE'),
    [form.fields],
  );

  const onRunRecognize = async (): Promise<void> => {
    const davinciClient = davinciContext?.client;
    if (!davinciClient) {
      log('no DaVinci client in context');
      return;
    }
    if (executor instanceof Error) {
      log(`recognize unavailable: ${executor.message}`);
      return;
    }
    log(`provider: ${executor.provider}`);
    for (let index = 0; index < recognizeCollectors.length; index += 1) {
      const result: RecognizeResult = await executor.runForDaVinci(
        davinciClient,
        { index },
      );
      log(`recognize[${index}] -> ${JSON.stringify(result)}`);
    }
    await next({ collectors: [] });
  };

  const onSubmitNode = async (): Promise<void> => {
    try {
      const nextNode = await next(form.input);
      log(`submit -> ${nextNode.type ?? 'unknown'}`);
    } catch (caught) {
      log(`submit failed: ${formatError(caught)}`);
    }
  };

  const onStart = async (): Promise<void> => {
    setLogLines([]);
    try {
      const started = await start();
      log(`start -> ${started.type ?? 'unknown'}`);
    } catch (caught) {
      log(`start failed: ${formatError(caught)}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      <View style={commonStyles.card}>
        <Text testID="recognize-davinci-poc-provider">{providerBadge}</Text>
        <Text>Android-only DaVinci RECOGNIZE collector POC</Text>
        <TouchableOpacity
          testID="recognize-davinci-poc-start"
          onPress={onStart}
          disabled={loading}
        >
          <Text>Start DaVinci flow</Text>
        </TouchableOpacity>
      </View>

      {node?.type === 'ContinueNode' ? (
        <View style={commonStyles.card}>
          <Text>
            Node: ContinueNode — Collectors:{' '}
            {form.fields.map(f => f.type).join(', ')}
          </Text>
          {form.fields.map(field => {
            if (field.type === 'RECOGNIZE') {
              return null;
            }
            if (field.type === 'LABEL' || field.type === 'READ_ONLY_TEXT') {
              const content = (field as { content?: string }).content ?? '';
              return content ? (
                <Text key={field.key} style={commonStyles.card}>
                  {content}
                </Text>
              ) : null;
            }
            if (field.type === 'TEXT') {
              return (
                <TextInput
                  key={field.key}
                  placeholder={
                    ('label' in field ? field.label : '') || field.type
                  }
                  value={String(form.values[field.key] ?? '')}
                  onChangeText={text => form.setValue(field.key, text)}
                  autoCapitalize="none"
                  style={commonStyles.card}
                />
              );
            }
            if (field.type === 'PASSWORD') {
              return (
                <TextInput
                  key={field.key}
                  placeholder={
                    ('label' in field ? field.label : '') || 'Password'
                  }
                  value={String(form.values[field.key] ?? '')}
                  onChangeText={text => form.setValue(field.key, text)}
                  secureTextEntry
                  autoCapitalize="none"
                  style={commonStyles.card}
                />
              );
            }
            if (field.type === 'SUBMIT_BUTTON') {
              return (
                <TouchableOpacity
                  key={field.key}
                  testID="recognize-davinci-poc-submit"
                  onPress={onSubmitNode}
                  disabled={loading}
                  style={commonStyles.card}
                >
                  <Text>
                    {('label' in field ? field.label : '') || 'Sign on'}
                  </Text>
                </TouchableOpacity>
              );
            }
            return (
              <Text key={field.key}>
                [{field.type}] {'label' in field ? field.label : ''}
              </Text>
            );
          })}
          {recognizeCollectors.length > 0 ? (
            <TouchableOpacity
              testID="recognize-davinci-poc-run"
              onPress={onRunRecognize}
              disabled={loading}
              style={commonStyles.card}
            >
              <Text>Run Recognize and continue</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {node?.type && node.type !== 'ContinueNode' ? (
        <View style={commonStyles.card}>
          <Text testID="recognize-davinci-poc-terminal">Node: {node.type}</Text>
          {node.type !== 'SuccessNode' && node.message ? (
            <Text>{node.message}</Text>
          ) : null}
        </View>
      ) : null}

      {error ? (
        <View style={commonStyles.card}>
          <Text>Hook error: {formatError(error)}</Text>
        </View>
      ) : null}

      <View style={commonStyles.card}>
        <Text>Log</Text>
        {logLines.map((line, i) => (
          <Text key={`${i}-${line}`} testID={`recognize-davinci-poc-log-${i}`}>
            {line}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

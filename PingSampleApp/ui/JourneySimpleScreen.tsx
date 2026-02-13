/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {
  JourneyCallback,
  JourneyCallbackInput,
} from '@ping-identity/rn-journey';
import { useJourney } from '@ping-identity/rn-journey';
import { commonStyles } from '../src/styles/common';
import { colors } from '../src/styles/colors';

type FieldValues = Record<string, string | boolean>;

type CallbackRow = {
  callback: JourneyCallback;
  typeIndex: number;
  key: string;
};

const outputOnlyCallbackTypes = new Set<string>([
  'TextOutputCallback',
  'SuspendedTextOutputCallback',
  'MetadataCallback',
  'PollingWaitCallback',
]);

const supportedManualCallbackTypes = new Set<string>([
  'NameCallback',
  'PasswordCallback',
  'TextInputCallback',
  'StringAttributeInputCallback',
  'NumberAttributeInputCallback',
  'BooleanAttributeInputCallback',
  'ChoiceCallback',
  'ValidatedCreateUsernameCallback',
  'ValidatedCreatePasswordCallback',
  'HiddenValueCallback',
  'TermsAndConditionsCallback',
]);

const booleanCallbackTypes = new Set<string>([
  'BooleanAttributeInputCallback',
  'TermsAndConditionsCallback',
]);

/**
 * Builds deterministic callback rows with per-type index.
 *
 * @param callbacks - ContinueNode callback list.
 * @returns Callback rows preserving type-local index for `next()` payloads.
 */
function buildCallbackRows(callbacks: JourneyCallback[]): CallbackRow[] {
  const typeCounts: Record<string, number> = {};
  return callbacks.map((callback) => {
    const typeIndex = typeCounts[callback.type] ?? 0;
    typeCounts[callback.type] = typeIndex + 1;
    return {
      callback,
      typeIndex,
      key: `${callback.type}:${typeIndex}`,
    };
  });
}

/**
 * Converts unknown values into UI strings.
 *
 * @param value - Arbitrary callback value.
 * @returns Display-safe string.
 */
function toDisplayString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === undefined || value === null) {
    return '';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Indicates whether callback should be submitted by the manual simple form.
 *
 * @param type - Callback type.
 * @returns `true` when callback is manually supported by simple mode.
 */
function isSupportedManualCallback(type: string): boolean {
  return supportedManualCallbackTypes.has(type);
}

/**
 * Renders a minimal Journey experience using only `useJourney()`.
 *
 * @remarks
 * This screen intentionally avoids sample helper hooks/renderers so developers can
 * see the raw tuple-based Journey contract with minimal abstraction.
 *
 * @returns Simple Journey screen element.
 */
export default function JourneySimpleScreen(): React.ReactElement {
  const [node, { start, next, resume, user, logoutUser, loading, error }] = useJourney();
  const [journeyName, setJourneyName] = useState<string>('Login');
  const [resumeUrl, setResumeUrl] = useState<string>('');
  const [fieldValues, setFieldValues] = useState<FieldValues>({});
  const [sessionPayload, setSessionPayload] = useState<string>('');

  const callbackRows = useMemo<CallbackRow[]>(() => {
    if (node?.type !== 'ContinueNode' || !Array.isArray(node.callbacks)) {
      return [];
    }
    return buildCallbackRows(node.callbacks as JourneyCallback[]);
  }, [node]);

  const unsupportedManualRows = useMemo<CallbackRow[]>(
    () =>
      callbackRows.filter((row) => {
        const type = row.callback.type;
        if (outputOnlyCallbackTypes.has(type)) {
          return false;
        }
        if (type === 'ConfirmationCallback') {
          return false;
        }
        return !isSupportedManualCallback(type);
      }),
    [callbackRows]
  );

  const manualRows = useMemo<CallbackRow[]>(
    () => callbackRows.filter((row) => isSupportedManualCallback(row.callback.type)),
    [callbackRows]
  );

  const onStart = async (): Promise<void> => {
    const trimmed = journeyName.trim();
    if (!trimmed) {
      Alert.alert('Enter a journey name first');
      return;
    }

    try {
      await start(trimmed);
      setFieldValues({});
      setSessionPayload('');
    } catch (cause) {
      Alert.alert('Start failed', String(cause));
    }
  };

  const onResume = async (): Promise<void> => {
    const trimmed = resumeUrl.trim();
    if (!trimmed) {
      Alert.alert('Paste a resume URL first');
      return;
    }

    try {
      await resume(trimmed);
      setResumeUrl('');
    } catch (cause) {
      Alert.alert('Resume failed', String(cause));
    }
  };

  const onSubmit = async (): Promise<void> => {
    if (unsupportedManualRows.length > 0) {
      Alert.alert(
        'Unsupported callback in simple mode',
        'Use Journey (Advanced) for this node.'
      );
      return;
    }

    const callbacks: JourneyCallbackInput[] = manualRows.map((row) => {
      const raw = fieldValues[row.key];
      if (booleanCallbackTypes.has(row.callback.type)) {
        return {
          type: row.callback.type,
          index: row.typeIndex,
          value: Boolean(raw),
        };
      }

      if (row.callback.type === 'NumberAttributeInputCallback' || row.callback.type === 'ChoiceCallback') {
        const numericValue = typeof raw === 'string' ? Number(raw) : Number(raw ?? 0);
        return {
          type: row.callback.type,
          index: row.typeIndex,
          value: Number.isFinite(numericValue) ? numericValue : 0,
        };
      }

      return {
        type: row.callback.type,
        index: row.typeIndex,
        value: toDisplayString(raw),
      };
    });

    try {
      await next({ callbacks });
    } catch (cause) {
      Alert.alert('Submit failed', String(cause));
    }
  };

  const onConfirmation = async (row: CallbackRow, optionIndex: number): Promise<void> => {
    try {
      await next({
        callbacks: [
          {
            type: row.callback.type,
            index: row.typeIndex,
            value: optionIndex,
          },
        ],
      });
    } catch (cause) {
      Alert.alert('Submit failed', String(cause));
    }
  };

  const onLoadSession = async (): Promise<void> => {
    try {
      const session = await user();
      setSessionPayload(session ? JSON.stringify(session, null, 2) : 'No session');
    } catch (cause) {
      Alert.alert('Session read failed', String(cause));
    }
  };

  const onLogout = async (): Promise<void> => {
    try {
      await logoutUser();
      setSessionPayload('');
      setFieldValues({});
    } catch (cause) {
      Alert.alert('Logout failed', String(cause));
    }
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      <View style={commonStyles.card}>
        <Text style={styles.title}>Journey (Simple)</Text>
        <Text style={styles.subtitle}>
          Minimal sample path using only `useJourney()`.
        </Text>

        <Text style={commonStyles.inputLabel}>Journey Name</Text>
        <TextInput
          style={commonStyles.input}
          value={journeyName}
          onChangeText={setJourneyName}
          placeholder="Login"
          placeholderTextColor={colors.gray}
        />

        <TouchableOpacity
          style={commonStyles.buttonPrimary}
          onPress={onStart}
          disabled={loading}
        >
          <Text style={commonStyles.buttonText}>Start</Text>
        </TouchableOpacity>

        <Text style={[commonStyles.inputLabel, styles.resumeLabel]}>Resume URL</Text>
        <TextInput
          style={commonStyles.input}
          value={resumeUrl}
          onChangeText={setResumeUrl}
          placeholder="myapp://oauth2redirect?..."
          placeholderTextColor={colors.gray}
        />
        <TouchableOpacity
          style={commonStyles.buttonSecondary}
          onPress={onResume}
          disabled={loading}
        >
          <Text style={commonStyles.buttonTextSecondary}>Resume</Text>
        </TouchableOpacity>
      </View>

      <View style={commonStyles.card}>
        <Text style={styles.sectionTitle}>Node State</Text>
        <Text style={commonStyles.codeText}>
          {node ? `type=${node.type ?? 'unknown'}, id=${node.id ?? 'n/a'}` : 'No active node'}
        </Text>
        {error ? <Text style={commonStyles.textError}>{error.message}</Text> : null}
      </View>

      {node?.type === 'ContinueNode' ? (
        <View style={commonStyles.card}>
          <Text style={styles.sectionTitle}>ContinueNode Callbacks</Text>

          {unsupportedManualRows.length > 0 ? (
            <Text style={commonStyles.textError}>
              Simple mode does not support: {unsupportedManualRows.map((row) => row.callback.type).join(', ')}
            </Text>
          ) : null}

          {callbackRows.map((row) => {
            const prompt = toDisplayString(
              row.callback.prompt ?? row.callback.message ?? row.callback.type
            );

            if (outputOnlyCallbackTypes.has(row.callback.type)) {
              return (
                <View key={row.key} style={styles.callbackBlock}>
                  <Text style={styles.callbackType}>{row.callback.type}</Text>
                  <Text style={styles.callbackPrompt}>{prompt}</Text>
                  {row.callback.value !== undefined ? (
                    <Text style={commonStyles.codeText}>{toDisplayString(row.callback.value)}</Text>
                  ) : null}
                </View>
              );
            }

            if (row.callback.type === 'ConfirmationCallback') {
              const options = Array.isArray(row.callback.options)
                ? (row.callback.options as unknown[])
                : ['Option 0', 'Option 1'];
              return (
                <View key={row.key} style={styles.callbackBlock}>
                  <Text style={styles.callbackType}>{row.callback.type}</Text>
                  <Text style={styles.callbackPrompt}>{prompt}</Text>
                  {options.map((option, optionIndex) => (
                    <TouchableOpacity
                      key={`${row.key}:${optionIndex}`}
                      style={commonStyles.buttonSecondary}
                      onPress={() => onConfirmation(row, optionIndex)}
                    >
                      <Text style={commonStyles.buttonTextSecondary}>
                        {toDisplayString(option)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            }

            const current = fieldValues[row.key];

            if (booleanCallbackTypes.has(row.callback.type)) {
              return (
                <View key={row.key} style={styles.callbackBlock}>
                  <Text style={styles.callbackType}>{row.callback.type}</Text>
                  <Text style={styles.callbackPrompt}>{prompt}</Text>
                  <Switch
                    value={Boolean(current)}
                    onValueChange={(value) => {
                      setFieldValues((previous) => ({ ...previous, [row.key]: value }));
                    }}
                  />
                </View>
              );
            }

            return (
              <View key={row.key} style={styles.callbackBlock}>
                <Text style={styles.callbackType}>{row.callback.type}</Text>
                <Text style={styles.callbackPrompt}>{prompt}</Text>
                <TextInput
                  style={commonStyles.input}
                  keyboardType={
                    row.callback.type === 'NumberAttributeInputCallback' ||
                    row.callback.type === 'ChoiceCallback'
                      ? 'numeric'
                      : 'default'
                  }
                  value={toDisplayString(current)}
                  onChangeText={(value) => {
                    setFieldValues((previous) => ({ ...previous, [row.key]: value }));
                  }}
                  placeholder="Enter value"
                  placeholderTextColor={colors.gray}
                />
              </View>
            );
          })}

          <TouchableOpacity
            style={commonStyles.buttonPrimary}
            onPress={onSubmit}
            disabled={loading || unsupportedManualRows.length > 0}
          >
            <Text style={commonStyles.buttonText}>Submit next()</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={commonStyles.card}>
        <Text style={styles.sectionTitle}>Session</Text>
        <TouchableOpacity
          style={commonStyles.buttonSecondary}
          onPress={onLoadSession}
          disabled={loading}
        >
          <Text style={commonStyles.buttonTextSecondary}>Load user()</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={commonStyles.buttonPrimary}
          onPress={onLogout}
          disabled={loading}
        >
          <Text style={commonStyles.buttonText}>Logout</Text>
        </TouchableOpacity>
        {sessionPayload ? (
          <View style={commonStyles.codeBox}>
            <Text style={commonStyles.codeText}>{sessionPayload}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 6,
  },
  subtitle: {
    color: colors.gray,
    marginBottom: 12,
    fontSize: 13,
  },
  sectionTitle: {
    color: colors.textDark,
    fontWeight: '700',
    marginBottom: 10,
    fontSize: 15,
  },
  resumeLabel: {
    marginTop: 14,
  },
  callbackBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fafafa',
  },
  callbackType: {
    color: colors.textDark,
    fontWeight: '700',
    marginBottom: 4,
  },
  callbackPrompt: {
    color: colors.gray,
    marginBottom: 8,
    fontSize: 13,
  },
});


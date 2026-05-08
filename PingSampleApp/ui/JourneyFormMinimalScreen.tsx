/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { callbackType } from '@ping-identity/rn-types';
import {
  useJourney,
  useJourneyForm,
  JourneyError,
} from '@ping-identity/rn-journey';
import { commonStyles } from '../src/styles/common';
import JourneyFieldRenderer from './journey/components/molecules/renderers/JourneyFieldRenderer';
import PingTextInput from './components/atoms/PingTextInput';

/**
 * Minimal Journey sample using `useJourney` + `useJourneyForm`.
 *
 * @returns Screen element.
 */
export default function JourneyFormMinimalScreen(): React.ReactElement {
  const [node, actions] = useJourney();
  const form = useJourneyForm(node);
  const [journeyName, setJourneyName] = useState<string>('Login');

  const startJourney = async (): Promise<void> => {
    const target = journeyName.trim();
    if (!target) {
      Alert.alert('Enter a journey name');
      return;
    }
    await actions.start(target);
  };

  const continueJourney = async (): Promise<void> => {
    if (!form.canSubmit) {
      Alert.alert(
        'Cannot continue',
        form.issues[0]?.message ?? 'Resolve callback issues first.',
      );
      return;
    }
    await actions.next(form.input);
  };

  const applyDemoCredentials = (): void => {
    const nameField = form.getFieldByType(callbackType.NameCallback);
    const passwordFields = form.getFieldsByType(callbackType.PasswordCallback);
    const passwordField = passwordFields[0];

    const didSetName = form.setValueByType(
      callbackType.NameCallback,
      'demo-user',
    );
    const didSetPassword = form.setValueByType(
      callbackType.PasswordCallback,
      'demo-password',
    );

    if (!didSetName || !didSetPassword) {
      Alert.alert(
        'Demo credentials skipped',
        `Name field: ${nameField ? 'found' : 'missing'}, Password field: ${
          passwordField ? 'found' : 'missing'
        }`,
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.journeyContainer}>
      <View style={commonStyles.journeyCard}>
        <Text style={commonStyles.journeyTitle}>
          Journey (minimal useJourneyForm)
        </Text>

        <PingTextInput
          label="Journey name"
          value={journeyName}
          onChangeText={setJourneyName}
          placeholder="Login"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={commonStyles.journeyButtonPrimary}
          onPress={() =>
            startJourney().catch(cause =>
              Alert.alert(
                'Start failed',
                cause instanceof JourneyError
                  ? `[${cause.code}] ${cause.message}`
                  : String(cause),
              ),
            )
          }
          disabled={actions.loading}
        >
          <Text style={commonStyles.journeyButtonText}>
            {node ? 'Restart Journey' : 'Start Journey'}
          </Text>
        </TouchableOpacity>

        {node?.type === 'ContinueNode' ? (
          <>
            {form.fields.map(field => (
              <JourneyFieldRenderer
                key={field.id}
                field={field}
                currentValue={form.values[field.id]}
                setFieldValue={form.setValue}
              />
            ))}

            {!form.canSubmit && form.issues.length > 0 ? (
              <Text style={commonStyles.textError}>
                {form.issues[0]?.message}
              </Text>
            ) : null}

            {form.meta.hasManual ? (
              <>
                <TouchableOpacity
                  style={commonStyles.buttonSecondary}
                  onPress={applyDemoCredentials}
                  disabled={actions.loading}
                >
                  <Text style={commonStyles.buttonText}>
                    Apply Demo Credentials
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={commonStyles.journeyButtonPrimary}
                  onPress={() =>
                    continueJourney().catch(cause =>
                      Alert.alert(
                        'Continue failed',
                        cause instanceof JourneyError
                          ? `[${cause.code}] ${cause.message}`
                          : String(cause),
                      ),
                    )
                  }
                  disabled={actions.loading}
                >
                  <Text style={commonStyles.journeyButtonText}>Continue</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={commonStyles.helperNote}>
                No manual callback input required for this node.
              </Text>
            )}
          </>
        ) : null}

        {node?.type === 'SuccessNode' ? (
          <>
            <Text style={commonStyles.textSuccess}>Success</Text>
            <TouchableOpacity
              style={commonStyles.buttonDanger}
              onPress={() =>
                actions
                  .logoutUser()
                  .catch(cause =>
                    Alert.alert(
                      'Logout failed',
                      cause instanceof JourneyError
                        ? `[${cause.code}] ${cause.message}`
                        : String(cause),
                    ),
                  )
              }
            >
              <Text style={commonStyles.buttonText}>Logout</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {node?.type === 'ErrorNode' || node?.type === 'FailureNode' ? (
          <Text style={commonStyles.textError}>
            {node.message || node.cause || 'Journey failed'}
          </Text>
        ) : null}

        {actions.error ? (
          <Text style={commonStyles.textError}>{actions.error.message}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

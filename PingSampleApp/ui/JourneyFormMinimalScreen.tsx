/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useJourney, useJourneyForm } from '@ping-identity/rn-journey';
import { commonStyles } from '../src/styles/common';
import JourneyFieldRenderer from './journey/components/renderers/JourneyFieldRenderer';

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
      Alert.alert('Cannot continue', form.issues[0]?.message ?? 'Resolve callback issues first.');
      return;
    }
    await actions.next(form.input);
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.journeyContainer}>
      <View style={commonStyles.journeyCard}>
        <Text style={commonStyles.journeyTitle}>Journey (minimal useJourneyForm)</Text>

        <Text style={commonStyles.journeyLabel}>Journey name</Text>
        <TextInput
          style={commonStyles.journeyInput}
          value={journeyName}
          onChangeText={setJourneyName}
          placeholder="Login"
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={commonStyles.journeyButtonPrimary}
          onPress={() => startJourney().catch((cause) => Alert.alert('Start failed', String(cause)))}
          disabled={actions.loading}
        >
          <Text style={commonStyles.journeyButtonText}>
            {node ? 'Restart Journey' : 'Start Journey'}
          </Text>
        </TouchableOpacity>

        {node?.type === 'ContinueNode' ? (
          <>
            {form.fields.map((field) => (
              <JourneyFieldRenderer
                key={field.id}
                field={field}
                currentValue={form.values[field.id]}
                setFieldValue={form.setValue}
              />
            ))}

            {!form.canSubmit && form.issues.length > 0 ? (
              <Text style={commonStyles.textError}>{form.issues[0]?.message}</Text>
            ) : null}

            {form.meta.hasManual ? (
              <TouchableOpacity
                style={commonStyles.journeyButtonPrimary}
                onPress={() => continueJourney().catch((cause) => Alert.alert('Continue failed', String(cause)))}
                disabled={actions.loading}
              >
                <Text style={commonStyles.journeyButtonText}>Continue</Text>
              </TouchableOpacity>
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
              onPress={() => actions.logoutUser().catch((cause) => Alert.alert('Logout failed', String(cause)))}
            >
              <Text style={commonStyles.buttonText}>Logout</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {node?.type === 'ErrorNode' || node?.type === 'FailureNode' ? (
          <Text style={commonStyles.textError}>{node.message || node.cause || 'Journey failed'}</Text>
        ) : null}

        {actions.error ? (
          <Text style={commonStyles.textError}>{actions.error.message}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

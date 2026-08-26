/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import type {
  DaVinciFieldValidationError,
  PasswordCollector,
} from '@ping-identity/rn-davinci';
import PingTextInput from '../../../components/atoms/PingTextInput';
import DaVinciErrorList from '../atoms/DaVinciErrorList';
import DaVinciPasswordRequirements from './DaVinciPasswordRequirements';
import { davinciFieldStyles } from '../../../../src/styles/davinciStyles';
import type { DaVinciCollectorRendererProps } from './types';

/**
 * Renders a {@link PasswordCollector} as a secure text input.
 *
 * @param props Renderer props.
 * @returns Password field element with optional policy requirements.
 */
export default function DaVinciPasswordField(
  props: DaVinciCollectorRendererProps,
): React.ReactElement {
  const { collector, value, onChange, onValidate } = props;
  const [manualErrors, setManualErrors] = useState<
    DaVinciFieldValidationError[] | null
  >(null);
  const passwordCollector = collector as PasswordCollector;
  const stringValue = typeof value === 'string' ? value : '';

  return (
    <View style={davinciFieldStyles.card}>
      <PingTextInput
        label={
          passwordCollector.required
            ? `${passwordCollector.label} *`
            : passwordCollector.label
        }
        value={stringValue}
        onChangeText={value => {
          setManualErrors(null);
          onChange(value);
        }}
        onBlur={() => {
          onValidate(collector.key, stringValue)
            .then(setManualErrors)
            .catch(error => {
              console.warn('[DaVinci] Password validation failed:', error);
            });
        }}
        secureTextEntry
        allowPasswordToggle
        autoCapitalize="none"
        autoCorrect={false}
      />
      {passwordCollector.passwordPolicy ? (
        <DaVinciPasswordRequirements
          policy={passwordCollector.passwordPolicy}
          value={stringValue}
        />
      ) : null}
      <DaVinciErrorList errors={manualErrors ?? undefined} />
    </View>
  );
}

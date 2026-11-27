/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { commonStyles } from '../../../../src/styles/common';
import { davinciFieldStyles } from '../../../../src/styles/davinciStyles';
import type { DaVinciCollectorRendererProps } from './types';

/**
 * Props for {@link DaVinciRecognizeField}.
 */
export type DaVinciRecognizeFieldProps = DaVinciCollectorRendererProps & {
  /**
   * Runs the native Recognize ceremony for this collector.
   *
   * @param collectorKey The collector key to process.
   */
  onRecognizeCeremony: (collectorKey: string) => Promise<void>;
};

/**
 * Renders a RECOGNIZE collector as a biometric ceremony button.
 *
 * @param props Renderer props extended with `onRecognizeCeremony`.
 * @returns Recognize ceremony button element.
 */
export default function DaVinciRecognizeField(
  props: DaVinciRecognizeFieldProps,
): React.ReactElement {
  const { collector, loading, onRecognizeCeremony } = props;

  // Integration collectors do not declare `label` in the normalized union;
  // the server payload may still carry one, so read it defensively.
  const label =
    'label' in collector && typeof collector.label === 'string'
      ? collector.label
      : '';
  const buttonLabel = 'Run Recognize (biometric)';

  return (
    <View style={davinciFieldStyles.card}>
      {label ? (
        <Text style={davinciFieldStyles.fieldLabel}>{label}</Text>
      ) : null}
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => void onRecognizeCeremony(collector.key)}
        disabled={loading}
        activeOpacity={0.8}
        style={commonStyles.buttonSecondary}
      >
        <Text style={commonStyles.buttonTextSecondary}>{buttonLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

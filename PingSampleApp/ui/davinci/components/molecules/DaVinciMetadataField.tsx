/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  buildMetadataError,
  type MetadataCollector,
} from '@ping-identity/rn-davinci';
import { colors } from '../../../../src/styles/colors';
import { commonStyles } from '../../../../src/styles/common';
import { davinciFieldStyles } from '../../../../src/styles/davinciStyles';
import type { DaVinciCollectorRendererProps } from './types';

/**
 * Demo success result stored by the "Set result" control.
 *
 * @remarks
 * A real integration replaces this with the object the connector expects —
 * any non-empty JSON object is a valid success result.
 */
const DEMO_SUCCESS_RESULT: Record<string, unknown> = {
  status: 'success',
  source: 'sample-app',
};

/**
 * Renders a {@link MetadataCollector} pause field: the connector payload as
 * pretty JSON plus demo controls that store a success result, an error
 * envelope, or clear the stored result.
 *
 * @remarks
 * SDK Integrator connector pause/resume: the SDK surfaces the opaque
 * `metadata` payload; the app performs the on-device work and stores a result
 * as the collector's form value before the flow can resume via `next()`.
 * This molecule is sample-app demo scaffolding — "Set result" stores
 * {@link DEMO_SUCCESS_RESULT} and "Set error" stores a
 * {@link buildMetadataError} envelope; a real integration would replace both
 * with the actual SDK work. "Clear" stores `null`, which the submit helper
 * treats as unset and blocks with `METADATA_RESULT_REQUIRED` until a result
 * is present (gating is result-set-based, independent of the server
 * `required` flag).
 *
 * @param props Renderer props.
 * @returns Metadata field element.
 */
export default function DaVinciMetadataField(
  props: DaVinciCollectorRendererProps,
): React.ReactElement {
  const { collector, value, onChange } = props;
  const metadataCollector = collector as MetadataCollector;
  const isSet = value !== undefined && value !== null;

  return (
    <View style={davinciFieldStyles.card}>
      <Text style={davinciFieldStyles.fieldLabel}>
        {metadataCollector.label || 'SDK metadata'}
      </Text>
      <Text style={davinciFieldStyles.helperText}>Connector payload:</Text>
      <Text
        testID={`davinci-field-${collector.key}-metadata-payload`}
        style={styles.jsonText}
        selectable
      >
        {JSON.stringify(metadataCollector.metadata, null, 2)}
      </Text>
      <Text style={davinciFieldStyles.helperText}>Result:</Text>
      <Text
        testID={`davinci-field-${collector.key}-metadata-value`}
        style={styles.jsonText}
        selectable
      >
        {isSet ? JSON.stringify(value, null, 2) : 'Not set'}
      </Text>
      {!isSet ? (
        <Text
          testID={`davinci-field-${collector.key}-metadata-unset`}
          style={davinciFieldStyles.errorText}
        >
          A result is required before the flow can resume.
        </Text>
      ) : null}
      <TouchableOpacity
        testID={`davinci-field-${collector.key}-metadata-set-result`}
        style={commonStyles.buttonSecondary}
        onPress={() => onChange(DEMO_SUCCESS_RESULT)}
      >
        <Text style={commonStyles.buttonTextSecondary}>Set result</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID={`davinci-field-${collector.key}-metadata-set-error`}
        style={commonStyles.buttonSecondary}
        onPress={() =>
          onChange(
            buildMetadataError(
              'USER_CANCELLED',
              'User cancelled the operation',
            ),
          )
        }
      >
        <Text style={commonStyles.buttonTextSecondary}>Set error</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID={`davinci-field-${collector.key}-metadata-clear`}
        style={commonStyles.buttonSecondary}
        disabled={!isSet}
        // setValue(key, null) keeps the key present with a null value; the
        // submit helper treats null the same as unset
        // (METADATA_RESULT_REQUIRED), so null is sufficient to "clear" here
        // and no clearValue prop needs threading through the renderer.
        onPress={() => onChange(null)}
      >
        <Text style={commonStyles.buttonTextSecondary}>Clear</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  jsonText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: colors.textDark,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
    marginBottom: 4,
  },
});

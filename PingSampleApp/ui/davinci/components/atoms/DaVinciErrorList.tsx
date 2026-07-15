/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Text, View } from 'react-native';
import type { DaVinciFieldValidationError } from '@ping-identity/rn-davinci';
import { davinciFieldStyles } from '../../../../src/styles/davinciStyles';

/**
 * Props for {@link DaVinciErrorList}.
 */
export type DaVinciErrorListProps = {
  /**
   * Validation errors produced by the native SDK's `validate()` call.
   */
  errors?: DaVinciFieldValidationError[];
};

/**
 * Maps a single validation error code to human readable text.
 *
 * @param error Validation error.
 * @returns User-facing message.
 */
function describeError(error: DaVinciFieldValidationError): string {
  if (error.code === 'REQUIRED') {
    return 'This field is required.';
  }
  return error.message;
}

/**
 * Renders a stack of inline validation error messages under a field.
 *
 * @param props Component props.
 * @returns Validation error list element, or `null` when nothing to show.
 */
export default function DaVinciErrorList(
  props: DaVinciErrorListProps,
): React.ReactElement | null {
  const { errors } = props;
  if (!errors || errors.length === 0) {
    return null;
  }
  return (
    <View>
      {errors.map((error, index) => (
        <Text
          key={`${error.code}-${index}`}
          style={davinciFieldStyles.errorText}
        >
          {describeError(error)}
        </Text>
      ))}
    </View>
  );
}

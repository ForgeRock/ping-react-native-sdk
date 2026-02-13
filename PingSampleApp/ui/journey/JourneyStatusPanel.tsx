/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import type { JourneyError, JourneyNode } from '@ping-identity/rn-journey';
import { commonStyles } from '../../src/styles/common';
import { readString } from './callbacks';

/**
 * Props for Journey status/terminal state panel.
 */
export type JourneyStatusPanelProps = {
  node: JourneyNode | null | undefined;
  error: JourneyError | null;
  givenName?: string;
  onRefreshSession: () => Promise<void>;
  onLogout: () => Promise<void>;
};

/**
 * Renders success/error/failure state UI and associated actions.
 *
 * @param props - Component props.
 * @returns Status panel markup.
 */
export default function JourneyStatusPanel(
  props: JourneyStatusPanelProps
): React.ReactElement {
  const { node, error, givenName, onRefreshSession, onLogout } = props;

  return (
    <>
      {node?.type === 'SuccessNode' ? (
        <>
          <Text style={commonStyles.textSuccess}>Welcome {givenName ?? 'User'}!</Text>
          <TouchableOpacity
            style={commonStyles.buttonSecondary}
            onPress={onRefreshSession}
          >
            <Text style={commonStyles.buttonTextSecondary}>Refresh Session</Text>
          </TouchableOpacity>
          <TouchableOpacity style={commonStyles.buttonPrimary} onPress={onLogout}>
            <Text style={commonStyles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {node?.type === 'ErrorNode' ? (
        <Text style={commonStyles.textError}>
          {readString(node.message, 'A server-side validation error occurred.')}
        </Text>
      ) : null}

      {node?.type === 'FailureNode' ? (
        <Text style={commonStyles.textError}>
          {readString(node.cause ?? node.message, 'An unexpected failure occurred.')}
        </Text>
      ) : null}

      {error ? (
        <Text style={commonStyles.textError}>{readString(error.message, String(error))}</Text>
      ) : null}
    </>
  );
}

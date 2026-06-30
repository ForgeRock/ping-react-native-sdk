/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { commonStyles } from '../../../../src/styles/common';
import { colors } from '../../../../src/styles/colors';
import { davinciScreenStyles } from '../../../../src/styles/davinciStyles';
import AsyncActionButton from '../../../components/molecules/AsyncActionButton';
import EmptyStateCard from '../../../components/molecules/EmptyStateCard';
import { useDaVinciClientPanelController } from '../../hooks/useDaVinciClientPanelController';
import DaVinciContinueNodePanel from './DaVinciContinueNodePanel';

/**
 * Props for {@link DaVinciClientPanel}.
 */
export type DaVinciClientPanelProps = {
  /**
   * Optional callback fired after the user dismisses a `SuccessNode`.
   *
   * @remarks
   * Use this to navigate away from the DaVinci screen on success.
   */
  onAuthenticated?: () => void;
};

/**
 * Top-level DaVinci sample organism — orchestrates loading, success, error,
 * and continue states for a single DaVinci client.
 *
 * @remarks
 * Must be rendered inside a `DaVinciProvider` so that
 * {@link useDaVinciClientPanelController} can resolve a client.
 *
 * @param props Panel props.
 * @returns DaVinci client panel element.
 */
export default function DaVinciClientPanel(
  props: DaVinciClientPanelProps,
): React.ReactElement {
  const { onAuthenticated } = props;
  const {
    node,
    form,
    loading,
    error,
    hasActiveSession,
    isSessionCheckRunning,
    onSubmit,
    onFlowAction,
    onStart,
    onLogout,
  } = useDaVinciClientPanelController({ onAuthenticated });

  return (
    <View style={davinciScreenStyles.panel}>
      <View style={commonStyles.card}>
        {node?.type === 'ContinueNode' ? (
          <DaVinciContinueNodePanel
            node={node}
            form={form}
            loading={loading}
            onSubmit={onSubmit}
            onFlowAction={onFlowAction}
          />
        ) : null}

        {node?.type === 'SuccessNode' || hasActiveSession ? (
          <View style={davinciScreenStyles.successCard}>
            <Text style={davinciScreenStyles.successTitle}>Authenticated</Text>
            <Text style={davinciScreenStyles.successText}>
              You have completed the DaVinci flow successfully.
            </Text>
            <AsyncActionButton label="Logout" onPress={onLogout} />
            <AsyncActionButton
              label="Run again"
              onPress={onStart}
              variant="secondary"
            />
          </View>
        ) : null}

        {node?.type === 'ErrorNode' ? (
          <View style={davinciScreenStyles.errorCard}>
            <Text style={davinciScreenStyles.errorCardTitle}>
              The server reported an error
            </Text>
            <Text style={davinciScreenStyles.errorCardMessage}>
              {node.message || 'Please try again.'}
            </Text>
          </View>
        ) : null}

        {node?.type === 'FailureNode' ? (
          <EmptyStateCard
            title="Flow failed"
            message={node.message || 'The DaVinci flow failed unexpectedly.'}
            ctaLabel="Retry"
            onCtaPress={onStart}
          />
        ) : null}

        {!node && !loading && !hasActiveSession && !isSessionCheckRunning ? (
          <EmptyStateCard
            title="DaVinci"
            message="Start a DaVinci flow to authenticate."
            ctaLabel="Start flow"
            onCtaPress={onStart}
          />
        ) : null}

        {error ? (
          <Text style={commonStyles.textError}>
            {`[${error.code}] ${error.message}`}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View style={davinciScreenStyles.loadingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.white} />
        </View>
      ) : null}
    </View>
  );
}

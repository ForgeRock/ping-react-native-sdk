/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { Text, View } from 'react-native';
import type { JourneySubmitIssue } from '@ping-identity/rn-journey';
import { commonStyles } from '../../../src/styles/common';
import { styles } from './journeyClientPanelStyles';

/**
 * Props for rendering submit-planner issues in sample UI.
 */
export type JourneySubmitIssuesCardProps = {
  issues: JourneySubmitIssue[];
};

/**
 * Renders a card containing helper submit planning issues.
 *
 * @param props - Component props.
 * @returns Submit issue list card.
 */
export default function JourneySubmitIssuesCard(
  props: JourneySubmitIssuesCardProps
): React.ReactElement | null {
  const { issues } = props;
  if (issues.length === 0) {
    return null;
  }

  return (
    <View style={commonStyles.card}>
      <Text style={styles.sectionTitle}>Submit Issues</Text>
      {issues.map((issue, index) => (
        <View key={`${issue.code}:${index}`} style={styles.issueCard}>
          <Text style={styles.issueCode}>{issue.code}</Text>
          <Text style={styles.issueMessage}>{issue.message}</Text>
        </View>
      ))}
    </View>
  );
}

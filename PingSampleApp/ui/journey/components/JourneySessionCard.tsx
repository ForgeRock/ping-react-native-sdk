/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { commonStyles } from '../../../src/styles/common';

/**
 * Props for journey session JSON card.
 */
export type JourneySessionCardProps = {
  sessionPayload: string | null;
};

/**
 * Renders formatted user session JSON when available.
 *
 * @param props - Component props.
 * @returns Session card markup.
 */
export default function JourneySessionCard(
  props: JourneySessionCardProps
): React.ReactElement {
  const { sessionPayload } = props;

  if (!sessionPayload) {
    return <></>;
  }

  return (
    <View style={commonStyles.codeBox}>
      <Text style={commonStyles.codeTitle}>User Session</Text>
      <View style={commonStyles.payloadScrollContainer}>
        <ScrollView
          style={commonStyles.payloadScroll}
          contentContainerStyle={commonStyles.payloadScrollContent}
          nestedScrollEnabled
        >
          <Text style={commonStyles.codeText}>{sessionPayload}</Text>
        </ScrollView>
      </View>
    </View>
  );
}

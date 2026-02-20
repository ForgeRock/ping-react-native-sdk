/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import {
  ScrollView,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { commonStyles } from '../../../src/styles/common';

/**
 * Props for `PayloadViewer`.
 */
export type PayloadViewerProps = {
  /**
   * Payload string to display.
   */
  payload: string;
  /**
   * Optional override style for the outer container.
   */
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * Optional override style for the scroll content container.
   */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * Optional override style for payload text.
   */
  textStyle?: StyleProp<TextStyle>;
};

/**
 * Renders a reusable scrollable payload block used by sample screens.
 *
 * @param props - Component props.
 * @returns Payload viewer element.
 */
export default function PayloadViewer(props: PayloadViewerProps): React.ReactElement {
  const { payload, containerStyle, contentContainerStyle, textStyle } = props;

  return (
    <ScrollView
      style={[commonStyles.payloadScrollContainer, containerStyle]}
      contentContainerStyle={[commonStyles.payloadScrollContent, contentContainerStyle]}
      nestedScrollEnabled
    >
      <Text style={[commonStyles.codeText, textStyle]}>{payload}</Text>
    </ScrollView>
  );
}

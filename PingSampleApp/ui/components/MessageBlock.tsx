/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../src/styles/colors';

type MessageBlockProps = {
  title: string;
  message: string;
};

/**
 * Reusable informational message card used across sample screens.
 *
 * @param props Message block props.
 * @param props.title Heading text.
 * @param props.message Supporting description text.
 * @returns Message block element.
 */
export default function MessageBlock({
  title,
  message,
}: MessageBlockProps): React.ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.messageBlockBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.messageBlockBorder,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.messageBlockTitle,
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: colors.messageBlockText,
    lineHeight: 24,
  },
});

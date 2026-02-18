/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { StyleSheet } from 'react-native';
import { colors } from '../../../src/styles/colors';

/**
 * Shared styles for Journey client panel composition.
 */
export const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  panelTitle: {
    color: colors.textDark,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.textDark,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  topGap: {
    marginTop: 10,
  },
  blockingNote: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  autoPollingNote: {
    color: colors.gray,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 4,
  },
  issueCard: {
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.warningBackgroundCard,
  },
  issueCode: {
    color: colors.warningText,
    fontWeight: '700',
    marginBottom: 4,
  },
  issueMessage: {
    color: colors.warningText,
    fontSize: 13,
  },
  disabledButton: {
    opacity: 0.55,
  },
});

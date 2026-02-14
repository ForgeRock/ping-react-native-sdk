/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { StyleSheet } from 'react-native';
import { colors } from '../../../../src/styles/colors';

/**
 * Shared style tokens for Journey callback field renderers.
 */
export const fieldStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
  },
  typeText: {
    color: colors.textDark,
    fontWeight: '700',
    marginBottom: 4,
  },
  promptText: {
    color: colors.gray,
    marginBottom: 8,
    fontSize: 13,
  },
  helperText: {
    color: colors.gray,
    marginBottom: 6,
    fontSize: 12,
  },
  contentText: {
    lineHeight: 18,
  },
  topGap: {
    marginTop: 10,
  },
  optionWrap: {
    marginBottom: 8,
  },
  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: '#FCECEC',
  },
  warningCard: {
    borderWidth: 1,
    borderColor: '#F8D7DA',
    borderRadius: 10,
    backgroundColor: '#FFF5F5',
    padding: 10,
    marginBottom: 10,
  },
  warningTitle: {
    color: '#8A1C23',
    fontWeight: '700',
    marginBottom: 4,
  },
  warningText: {
    color: '#8A1C23',
    fontSize: 13,
  },
});

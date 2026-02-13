/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

import { StyleSheet } from 'react-native';
import { colors } from '../../../src/styles/colors';

/**
 * Shared styles for journey callback renderers.
 */
export const rendererStyles = StyleSheet.create({
  messageCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  messageText: {
    color: colors.textDark,
    fontSize: 14,
    marginTop: 6,
  },
  metadataCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  warningCard: {
    borderWidth: 1,
    borderColor: '#f4b2b5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fff7f7',
  },
  warningTitle: {
    color: colors.error,
    fontWeight: '700',
    marginBottom: 6,
  },
  warningText: {
    color: colors.textDark,
    fontSize: 13,
    lineHeight: 18,
  },
  resumeButton: {
    marginTop: 10,
  },
  choiceContainer: {
    marginBottom: 14,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  choiceButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  choiceOutlineButton: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  choiceOutlineButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: '#fdeff0',
  },
  choiceOutlineButtonText: {
    color: colors.textDark,
    fontSize: 13,
  },
  choiceOutlineButtonTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  switchRow: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    gap: 8,
  },
  switchLabel: {
    flex: 1,
    color: colors.textDark,
    fontSize: 14,
  },
  termsContainer: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  termsBody: {
    color: colors.textDark,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  termsMeta: {
    color: colors.gray,
    fontSize: 12,
    marginBottom: 2,
  },
  kbaContainer: {
    marginBottom: 14,
  },
  kbaAnswerInput: {
    marginTop: 8,
  },
});

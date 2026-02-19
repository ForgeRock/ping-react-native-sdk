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
    padding: 0,
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  promptText: {
    color: colors.gray,
    marginBottom: 8,
    fontSize: 13,
  },
  outputHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  outputIcon: {
    marginRight: 8,
  },
  outputPromptText: {
    color: colors.gray,
    fontSize: 13,
    flex: 1,
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
  dropdownTrigger: {
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: colors.inputInactiveBorder,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTriggerText: {
    color: colors.inputInactiveText,
    fontSize: 16,
    flex: 1,
    paddingRight: 10,
  },
  dropdownChevron: {
    color: colors.inputInactiveText,
    fontSize: 11,
    fontWeight: '700',
  },
  dropdownMenu: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  dropdownMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownMenuItemSelected: {
    backgroundColor: colors.selectedOptionBackground,
  },
  dropdownMenuItemText: {
    color: colors.inputInactiveText,
    fontSize: 15,
  },
  dropdownMenuItemTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputFlex: {
    flex: 1,
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  toggleButtonText: {
    color: colors.textDark,
    fontSize: 13,
    fontWeight: '600',
  },
  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: colors.selectedOptionBackground,
  },
  warningCard: {
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 10,
    backgroundColor: colors.warningBackgroundSoft,
    padding: 10,
    marginBottom: 10,
  },
  warningTitle: {
    color: colors.warningText,
    fontWeight: '700',
    marginBottom: 4,
  },
  warningText: {
    color: colors.warningText,
    fontSize: 13,
  },
  payloadScroll: {
    maxHeight: 160,
  },
});

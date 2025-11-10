import { StyleSheet, Platform } from 'react-native';
import { colors } from './colors';

export const commonStyles = StyleSheet.create({
  // ===== Base Containers =====
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: 16,
    alignItems: 'center',
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    width: '100%',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 1,
    elevation: 1,
  },

  // ===== Inputs =====
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: colors.surface,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: colors.textDark,
  },

  // ===== Buttons =====
  buttonPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 6,
  },
  buttonDanger: {
    backgroundColor: colors.error,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  buttonTextSecondary: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },

  // ===== Text =====
  textSuccess: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 10,
  },
  textError: {
    color: colors.error,
    textAlign: 'center',
    fontWeight: '500',
    marginVertical: 8,
  },

  // ===== Code / Debug Box =====
  codeBox: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
  },
  codeTitle: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 8,
    color: colors.textDark,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#333',
  },

  // ===== Home Screen Extensions =====
  homeContainer: {
    flexGrow: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 90,
  },
  homeLogo: {
    width: 240,
    height: 80,
    resizeMode: 'contain',
    marginBottom: 40,
    alignSelf: 'center',
  },
  homeRow: {
    backgroundColor: colors.surface,
    width: '90%',
    alignSelf: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  homeRowText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textDark,
  },
  homeFooter: {
    marginTop: 50,
  },
  homeFooterText: {
    fontSize: 13,
    color: colors.gray,
    textAlign: 'center',
  },

  // ===== Journey Screen Styles =====
  journeyContainer: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 40,
    alignItems: 'center',
  },

  journeyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '100%',
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },

  journeyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textDark,
    textAlign: 'center',
    marginBottom: 24,
  },

  journeySectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 12,
  },

  journeyButtonPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },

  journeyButtonSecondary: {
    backgroundColor: '#0056b3',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },

  journeyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },

  journeyInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
    marginBottom: 10,
  },

  journeyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 6,
  },

  suggestionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 16,
  },

  suggestionChip: {
    borderColor: colors.border,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    margin: 4,
  },

  suggestionText: {
    color: colors.textDark,
    fontSize: 14,
  },

  inputGroup: {
    marginBottom: 14,
  },


  suspendedBox: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },

  suspendedMessage: {
    color: colors.textDark,
    fontSize: 15,
    lineHeight: 20,
  },

  helperNote: {
    marginTop: 8,
    color: colors.gray,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});

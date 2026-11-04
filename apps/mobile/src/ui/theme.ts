import { StyleSheet } from 'react-native';

export const colors = {
  background: '#091923',
  surface: '#102839',
  panel: 'rgba(29,57,73,0.72)',
  text: '#F4FAFC',
  muted: '#B5CBD5',
  accent: '#A0E4EF',
  ink: '#102839',
  border: 'rgba(140,180,196,0.28)',
  brightBorder: 'rgba(160,228,239,0.54)',
  warning: '#F7D49C',
  danger: '#FFB3B8',
};

export const layout = StyleSheet.create({
  page: { padding: 20, paddingBottom: 36, gap: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stack: { gap: 12 },
  flex: { flex: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  title: {
    fontSize: 28,
    lineHeight: 38,
    fontWeight: '600',
    color: colors.text,
  },
  heading: {
    fontSize: 19,
    lineHeight: 28,
    fontWeight: '600',
    color: colors.text,
  },
  body: { fontSize: 15, lineHeight: 24, color: colors.muted },
  small: { fontSize: 13, lineHeight: 21, color: colors.muted },
  label: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.accent,
    fontWeight: '600',
  },
  strong: {
    fontSize: 16,
    lineHeight: 25,
    color: colors.text,
    fontWeight: '600',
  },
  accent: { color: colors.accent },
  warning: { color: colors.warning },
  error: { fontSize: 14, lineHeight: 22, color: colors.danger },
  input: {
    minHeight: 50,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: colors.text,
  },
});

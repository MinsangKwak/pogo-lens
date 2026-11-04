import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, layout } from './theme';

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  disabled,
  secondary,
  danger,
  busy,
  hint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
  busy?: boolean;
  hint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        danger && styles.danger,
        pressed && styles.pressed,
        (disabled || busy) && styles.disabled,
      ]}
    >
      {busy && (
        <ActivityIndicator color={secondary ? colors.accent : colors.ink} />
      )}
      <Text
        style={[
          styles.buttonText,
          secondary && styles.secondaryText,
          danger && styles.dangerText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Choice({
  label,
  detail,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.chosen,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <View style={layout.flex}>
        <Text style={layout.strong}>{label}</Text>
        {detail && <Text style={layout.small}>{detail}</Text>}
      </View>
    </Pressable>
  );
}

export function Badge({
  label,
  warning,
}: {
  label: string;
  warning?: boolean;
}) {
  return (
    <View style={styles.badge}>
      <Text style={[styles.badgeText, warning && layout.warning]}>{label}</Text>
    </View>
  );
}

export function ScreenHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <View style={layout.stack}>
      <Text style={layout.label}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={layout.title}>
        {title}
      </Text>
      <Text style={layout.body}>{description}</Text>
    </View>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[layout.small, layout.flex]}>{label}</Text>
      <Text style={[layout.strong, styles.infoValue]}>{value}</Text>
    </View>
  );
}

export function Notice({ text, error }: { text: string; error?: boolean }) {
  return (
    <View
      accessibilityRole={error ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.notice, error && styles.errorNotice]}
    >
      <Text style={error ? layout.error : layout.small}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  button: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondary: { backgroundColor: 'transparent', borderColor: colors.border },
  danger: { backgroundColor: 'transparent', borderColor: '#FFB3B866' },
  buttonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 23,
  },
  secondaryText: { color: colors.text },
  dangerText: { color: colors.danger },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.42 },
  choice: {
    minHeight: 52,
    borderRadius: 15,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chosen: { borderColor: colors.accent, backgroundColor: '#A0E4EF0D' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderColor: colors.muted,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.accent },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { fontSize: 12, color: colors.accent, lineHeight: 18 },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  infoValue: { flexShrink: 1, textAlign: 'right' },
  notice: {
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#A0E4EF08',
  },
  errorNotice: { borderColor: '#FFB3B844', backgroundColor: '#FFB3B808' },
});

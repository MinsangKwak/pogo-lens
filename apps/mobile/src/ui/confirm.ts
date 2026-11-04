import { Alert, Platform } from 'react-native';

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  options: {
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
  } = {},
) {
  if (Platform.OS === 'web') {
    const browser = globalThis as unknown as {
      confirm?: (text: string) => boolean;
    };
    if (browser.confirm?.(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: options.cancelLabel ?? '취소', style: 'cancel' },
    {
      text: options.confirmLabel ?? '확인',
      style: options.destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}

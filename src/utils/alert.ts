import { Alert, Platform } from 'react-native';

export type AlertButton = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

/**
 * Cross-platform alert/confirm helper.
 *
 * react-native-web's `Alert.alert` is a no-op, so on web this app never showed
 * dialogs and never invoked button `onPress` callbacks. This wrapper keeps the
 * native `Alert.alert` behavior on iOS/Android, and falls back to
 * `window.alert` / `window.confirm` on web so the same call sites work
 * everywhere.
 *
 * - No buttons or a single button: shows a plain alert, then calls that
 *   button's `onPress` (if any).
 * - Two or more buttons: shows a confirm dialog. Confirming calls the
 *   non-cancel button's `onPress`; cancelling calls the `cancel` button's
 *   `onPress`.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const fullMessage = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(fullMessage);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancelButton = buttons.find((button) => button.style === 'cancel');
  const confirmButton = buttons.find((button) => button !== cancelButton) ?? buttons[0];

  if (window.confirm(fullMessage)) {
    confirmButton?.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}

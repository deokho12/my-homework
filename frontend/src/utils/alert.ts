export type AlertButton = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

/**
 * Alert/confirm helper.
 *
 * Behaviour is unchanged from the previous cross-platform version's web branch
 * (the native `Alert.alert` branch is gone along with react-native):
 *
 * - No buttons or a single button: shows a plain alert, then calls that
 *   button's `onPress` (if any).
 * - Two or more buttons: shows a confirm dialog. Confirming calls the
 *   non-cancel button's `onPress`; cancelling calls the `cancel` button's
 *   `onPress`.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
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

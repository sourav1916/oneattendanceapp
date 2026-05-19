import { Alert } from 'react-native';

/** Lightweight feedback until a shared toast/snackbar is added. */
export function showAuthErrorToast(message: string): void {
  const text = message.trim() || 'Something went wrong. Please try again.';
  Alert.alert('Error', text);
}

export function showAuthSuccessToast(message: string): void {
  const text = message.trim() || 'Success';
  Alert.alert('Success', text);
}

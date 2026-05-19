import { Alert, Linking } from 'react-native';

export function openAppSettings(): void {
  void Linking.openSettings().catch(() => {
    /* noop */
  });
}

type LocationAlertKind = 'permission' | 'position';

/**
 * Explains why location is required and offers to open the app permission screen.
 * Resolves when the alert is dismissed.
 */
export function showLocationRequiredAlert(kind: LocationAlertKind): Promise<void> {
  return new Promise(resolve => {
    const openSettings = () => {
      openAppSettings();
      resolve();
    };

    if (kind === 'permission') {
      Alert.alert(
        'Location permission required',
        'Sign-in needs your location to verify OTP. Open Settings, allow Location for One Attendance, then return and try again.',
        [
          { text: 'Not now', style: 'cancel', onPress: () => resolve() },
          { text: 'Open Settings', onPress: openSettings },
        ],
      );
      return;
    }

    Alert.alert(
      "Can't read location",
      'Turn on Location services and allow access for this app in Settings, then try again.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
        { text: 'Open Settings', onPress: openSettings },
      ],
    );
  });
}

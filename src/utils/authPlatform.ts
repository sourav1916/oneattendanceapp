import { Platform } from 'react-native';

export type AuthContinuePlatform = 'android' | 'ios' | 'web';

/** Platform value for `/auth/continue/*` endpoints. */
export function getAuthContinuePlatform(): AuthContinuePlatform {
  if (Platform.OS === 'ios') {
    return 'ios';
  }
  if (Platform.OS === 'android') {
    return 'android';
  }
  return 'web';
}

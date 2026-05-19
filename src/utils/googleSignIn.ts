import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
  type SignInResponse,
} from '@react-native-google-signin/google-signin';
import { Platform, TurboModuleRegistry } from 'react-native';

import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '@src/utils/config';

type GoogleSignInNativeModule = {
  configure(params: {
    webClientId?: string;
    offlineAccess?: boolean;
    scopes?: string[];
  }): Promise<void>;
};

const GoogleSignInNative = TurboModuleRegistry.getEnforcing(
  'RNGoogleSignin',
) as GoogleSignInNativeModule;

const ANDROID_DEBUG_SHA1 =
  '5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25';

let configurePromise: Promise<void> | null = null;

export function configureGoogleSignIn(): void {
  void ensureGoogleSignInConfigured();
}

/** Await native SDK configuration (required before sign-in). */
export async function ensureGoogleSignInConfigured(): Promise<void> {
  if (!GOOGLE_WEB_CLIENT_ID.trim()) {
    throw new Error(
      'GOOGLE_WEB_CLIENT_ID is not set. Create a Web application OAuth client in Google Cloud (same project as GOOGLE_ANDROID_CLIENT_ID) and add its client ID to src/utils/config.ts.',
    );
  }

  if (!configurePromise) {
    const options = {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
      scopes: [] as string[],
    };
    configurePromise = GoogleSignInNative.configure(options).then(() => {
      GoogleSignin.configure(options);
    });
  }

  await configurePromise;
}

export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('Google sign-in was cancelled.');
    this.name = 'GoogleSignInCancelledError';
  }
}

export class GoogleSignInConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleSignInConfigError';
  }
}

export function mapGoogleSignInError(err: unknown): string {
  if (err instanceof GoogleSignInConfigError) {
    return err.message;
  }

  if (isErrorWithCode(err)) {
    const code = String(err.code);
    const message = String(err.message ?? '');
    const isDeveloperError =
      code === '10' ||
      message.toUpperCase().includes('DEVELOPER_ERROR') ||
      message.toLowerCase().includes('developer_error');

    if (isDeveloperError) {
      return [
        'Google Sign-In is misconfigured (DEVELOPER_ERROR).',
        'In Google Cloud Console → Credentials:',
        '1) Create an OAuth client of type Android with package in.onesaas.attendance',
        `   and SHA-1 ${ANDROID_DEBUG_SHA1} (see context/SHA.md).`,
        `2) Android OAuth client ID is already set (${GOOGLE_ANDROID_CLIENT_ID.slice(0, 20)}…).`,
        '3) Create a Web application OAuth client and set GOOGLE_WEB_CLIENT_ID in config.ts (required for the SDK).',
        '4) Rebuild the app after saving credentials (wait a few minutes for Google).',
      ].join('\n');
    }

    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return 'Google Play Services is not available on this device.';
    }
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return 'Google sign-in failed.';
}

/**
 * Shows Google account picker and returns a Google ID token for the backend.
 */
export async function requestGoogleIdToken(): Promise<string> {
  await ensureGoogleSignInConfigured();

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  try {
    await GoogleSignin.signOut();
  } catch {
    // No prior session — safe to ignore.
  }

  let result: SignInResponse;
  try {
    result = await GoogleSignin.signIn();
  } catch (err: unknown) {
    if (
      isErrorWithCode(err) &&
      err.code === statusCodes.SIGN_IN_CANCELLED
    ) {
      throw new GoogleSignInCancelledError();
    }
    throw new Error(mapGoogleSignInError(err));
  }

  if (result.type === 'cancelled') {
    throw new GoogleSignInCancelledError();
  }

  let idToken = result.data.idToken;
  if (!idToken?.trim()) {
    const tokens = await GoogleSignin.getTokens();
    idToken = tokens.idToken;
  }

  if (!idToken?.trim()) {
    throw new Error('Google sign-in did not return an ID token.');
  }

  return idToken.trim();
}

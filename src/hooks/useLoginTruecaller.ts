import {
  TRUECALLER_ANDROID_CUSTOMIZATIONS,
  useTruecaller,
  type TruecallerAndroidResponse,
  type TruecallerUserProfile,
} from '@ajitpatel28/react-native-truecaller';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useAppTheme } from '@src/context/ThemeContext';
import {
  isTruecallerConfigured,
  TRUECALLER_ANDROID_CLIENT_ID,
  TRUECALLER_IOS_APP_KEY,
  TRUECALLER_IOS_APP_LINK,
} from '@src/utils/config';
import { isTruecallerUserDismissal } from '@src/utils/truecallerErrors';

type Options = {
  /** When true, opens the Truecaller consent UI after SDK init if the app is available. */
  autoOpenOnMount?: boolean;
  onProfile?: (profile: TruecallerUserProfile) => void;
  onOAuthSuccess?: (data: TruecallerAndroidResponse) => void;
  onError?: (message: string) => void;
};

function notifyTruecallerError(
  onError: Options['onError'],
  message: string,
): void {
  if (!message.trim() || isTruecallerUserDismissal(message)) {
    return;
  }
  onError?.(message);
}

export function useLoginTruecaller({
  autoOpenOnMount = true,
  onProfile,
  onOAuthSuccess,
  onError,
}: Options = {}) {
  const { resolvedScheme } = useAppTheme();
  const autoOpenedRef = useRef(false);
  const [isTruecallerAvailable, setIsTruecallerAvailable] = useState(false);
  const [availabilityResolved, setAvailabilityResolved] = useState(false);

  const handleAndroidOAuthSuccess = useCallback(
    (data: TruecallerAndroidResponse) => {
      void onOAuthSuccess?.(data);
    },
    [onOAuthSuccess],
  );

  const truecallerConfig = useMemo(
    () => ({
      androidClientId: TRUECALLER_ANDROID_CLIENT_ID,
      iosAppKey: TRUECALLER_IOS_APP_KEY,
      iosAppLink: TRUECALLER_IOS_APP_LINK,
      androidConsentHeading:
        TRUECALLER_ANDROID_CUSTOMIZATIONS.CONSENT_HEADINGS.SIGN_IN_TO,
      androidConsentMode:
        TRUECALLER_ANDROID_CUSTOMIZATIONS.CONSENT_MODES.BOTTOMSHEET,
      androidDarkMode: resolvedScheme === 'dark',
      androidSuccessHandler:
        Platform.OS === 'android' ? handleAndroidOAuthSuccess : undefined,
    }),
    [handleAndroidOAuthSuccess, resolvedScheme],
  );

  const {
    initializeTruecallerSDK,
    openTruecallerForVerification,
    isSdkUsable,
    userProfile,
    error,
    clearTruecallerSdk,
  } = useTruecaller(truecallerConfig);

  const sdkRef = useRef({
    initializeTruecallerSDK,
    isSdkUsable,
    openTruecallerForVerification,
    clearTruecallerSdk,
  });
  sdkRef.current = {
    initializeTruecallerSDK,
    isSdkUsable,
    openTruecallerForVerification,
    clearTruecallerSdk,
  };

  const checkTruecallerAvailability = useCallback(async (): Promise<boolean> => {
    if (!isTruecallerConfigured()) {
      setIsTruecallerAvailable(false);
      setAvailabilityResolved(true);
      return false;
    }

    try {
      await sdkRef.current.initializeTruecallerSDK();
      const usable = await sdkRef.current.isSdkUsable();
      setIsTruecallerAvailable(usable);
      setAvailabilityResolved(true);
      return usable;
    } catch {
      setIsTruecallerAvailable(false);
      setAvailabilityResolved(true);
      return false;
    }
  }, []);

  const openTruecallerLogin = useCallback(async () => {
    if (!isTruecallerConfigured()) {
      notifyTruecallerError(
        onError,
        'Truecaller is not configured. Add your client ID in src/utils/config.ts and android/gradle.properties.',
      );
      return;
    }

    try {
      const usable = await checkTruecallerAvailability();
      if (!usable) {
        notifyTruecallerError(
          onError,
          'Truecaller is not available on this device. Install Truecaller or use email login.',
        );
        return;
      }
      await sdkRef.current.openTruecallerForVerification();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Truecaller sign-in failed.';
      notifyTruecallerError(onError, message);
    }
  }, [checkTruecallerAvailability, onError]);

  useEffect(() => {
    if (!isTruecallerConfigured()) {
      setIsTruecallerAvailable(false);
      setAvailabilityResolved(true);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        const usable = await checkTruecallerAvailability();
        if (cancelled || !usable || !autoOpenOnMount || autoOpenedRef.current) {
          return;
        }
        autoOpenedRef.current = true;
        await sdkRef.current.openTruecallerForVerification();
      } catch {
        // Errors surface via hook `error` or openTruecallerLogin retry.
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [autoOpenOnMount, checkTruecallerAvailability]);

  useEffect(() => {
    return () => {
      if (Platform.OS === 'android') {
        sdkRef.current.clearTruecallerSdk();
      }
    };
  }, []);

  useEffect(() => {
    if (userProfile) {
      onProfile?.(userProfile);
    }
  }, [onProfile, userProfile]);

  useEffect(() => {
    if (error) {
      notifyTruecallerError(onError, error);
    }
  }, [error, onError]);

  return {
    openTruecallerLogin,
    isTruecallerConfigured: isTruecallerConfigured(),
    isTruecallerAvailable,
    /** False until the first install/availability check finishes. */
    availabilityResolved,
    checkTruecallerAvailability,
    truecallerProfile: userProfile,
  };
}

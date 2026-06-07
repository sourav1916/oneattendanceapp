import type { NavigationContainerRef, ParamListBase } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Platform, ToastAndroid } from 'react-native';

const EXIT_WINDOW_MS = 2000;

export function useAndroidDoubleBackExit(
  navigationRef: NavigationContainerRef<ParamListBase>,
) {
  const { t } = useTranslation();
  const lastBackPressAt = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const onBackPress = () => {
      if (!navigationRef.isReady() || navigationRef.canGoBack()) {
        return false;
      }

      const now = Date.now();
      if (now - lastBackPressAt.current < EXIT_WINDOW_MS) {
        lastBackPressAt.current = 0;
        BackHandler.exitApp();
        return true;
      }

      lastBackPressAt.current = now;
      ToastAndroid.show(t('app.pressBackAgainToExit'), ToastAndroid.SHORT);
      return true;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    );
    return () => subscription.remove();
  }, [navigationRef, t]);
}

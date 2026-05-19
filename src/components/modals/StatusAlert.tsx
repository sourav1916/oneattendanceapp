import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { IconProps } from 'react-native-vector-icons/Icon';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  ConfirmAlert,
  type ConfirmAlertButton,
  type ConfirmAlertPresentConfig,
  useConfirmAlert,
} from '@src/components/modals/ConfirmAlert';
import { useAppTheme } from '@src/context/ThemeContext';

export type StatusAlertTone = 'success' | 'error' | 'warning' | 'info';

type ToneVisual = {
  icon: IconProps['name'];
  ringLight: string;
  ringDark: string;
  glyphLight: string;
  glyphDark: string;
  primaryButtonVariant: ConfirmAlertButton['variant'];
};

const TONE_VISUALS: Record<StatusAlertTone, ToneVisual> = {
  success: {
    icon: 'check-circle',
    ringLight: '#dcfce7',
    ringDark: '#14532d',
    glyphLight: '#16a34a',
    glyphDark: '#4ade80',
    primaryButtonVariant: 'primary',
  },
  error: {
    icon: 'close-circle',
    ringLight: '#fee2e2',
    ringDark: '#450a0a',
    glyphLight: '#dc2626',
    glyphDark: '#f87171',
    primaryButtonVariant: 'danger',
  },
  warning: {
    icon: 'alert-circle',
    ringLight: '#fef3c7',
    ringDark: '#422006',
    glyphLight: '#d97706',
    glyphDark: '#fbbf24',
    primaryButtonVariant: 'primary',
  },
  info: {
    icon: 'information',
    ringLight: '#dbeafe',
    ringDark: '#1e3a5f',
    glyphLight: '#2563eb',
    glyphDark: '#60a5fa',
    primaryButtonVariant: 'primary',
  },
};

export type StatusAlertPresentConfig = {
  tone: StatusAlertTone;
  title: string;
  message?: string;
  showMessage?: boolean;
  /** Defaults to a single primary/danger “OK” button */
  buttons?: ConfirmAlertButton[];
  buttonText?: string;
  dismissOnIconPress?: boolean;
  /** Accessibility label for the tappable status icon */
  dismissIconA11y?: string;
  onAfterDismiss?: () => void;
} & Pick<
  ConfirmAlertPresentConfig,
  'dismissOnBackdropPress' | 'dismissOnHardwareBack' | 'buttonLayout' | 'maxDialogWidth'
>;

type StatusAlertIconProps = {
  tone: StatusAlertTone;
  onPress?: () => void;
  accessibilityLabel: string;
};

export function StatusAlertIcon({ tone, onPress, accessibilityLabel }: StatusAlertIconProps) {
  const { resolvedScheme } = useAppTheme();
  const visual = TONE_VISUALS[tone];
  const ringColor = resolvedScheme === 'dark' ? visual.ringDark : visual.ringLight;
  const glyphColor = resolvedScheme === 'dark' ? visual.glyphDark : visual.glyphLight;

  const iconNode = (
    <View style={[styles.iconRing, { backgroundColor: ringColor }]}>
      <MaterialCommunityIcons name={visual.icon} size={36} color={glyphColor} />
    </View>
  );

  if (!onPress) {
    return <View style={styles.iconOuter}>{iconNode}</View>;
  }

  return (
    <View style={styles.iconOuter}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [pressed && styles.iconPressed]}>
        {iconNode}
      </Pressable>
    </View>
  );
}

function buildStatusPayload(
  config: StatusAlertPresentConfig,
  dismiss: () => void,
): ConfirmAlertPresentConfig {
  const {
    tone,
    title,
    message,
    showMessage = true,
    buttons,
    buttonText = 'OK',
    dismissOnIconPress = true,
    dismissIconA11y = 'Dismiss',
    onAfterDismiss,
    ...rest
  } = config;

  const visual = TONE_VISUALS[tone];
  const resolvedButtons =
    buttons && buttons.length > 0
      ? buttons
      : [{ text: buttonText, variant: visual.primaryButtonVariant }];

  return {
    title,
    message,
    showMessage: showMessage && Boolean(message?.trim()),
    showTitle: true,
    childrenPlacement: 'aboveTitle' as const,
    children: (
      <StatusAlertIcon
        tone={tone}
        onPress={dismissOnIconPress ? dismiss : undefined}
        accessibilityLabel={dismissIconA11y}
      />
    ),
    buttons: resolvedButtons,
    onAfterDismiss,
    ...rest,
  };
}

/**
 * Imperative success / error / warning / info alerts with a themed icon header.
 * Mount `<StatusAlert {...props} />` once per screen (same pattern as {@link ConfirmAlert}).
 */
export function useStatusAlert(defaults?: Partial<StatusAlertPresentConfig>) {
  const { props, present: presentConfirm, dismiss, visible } = useConfirmAlert();

  const present = useCallback(
    (config: StatusAlertPresentConfig) => {
      presentConfirm(buildStatusPayload({ ...defaults, ...config }, () => dismiss()));
    },
    [defaults, dismiss, presentConfirm],
  );

  const presentSuccess = useCallback(
    (config: Omit<StatusAlertPresentConfig, 'tone'>) => present({ ...config, tone: 'success' }),
    [present],
  );

  const presentError = useCallback(
    (config: Omit<StatusAlertPresentConfig, 'tone'>) => present({ ...config, tone: 'error' }),
    [present],
  );

  const presentWarning = useCallback(
    (config: Omit<StatusAlertPresentConfig, 'tone'>) => present({ ...config, tone: 'warning' }),
    [present],
  );

  const presentInfo = useCallback(
    (config: Omit<StatusAlertPresentConfig, 'tone'>) => present({ ...config, tone: 'info' }),
    [present],
  );

  return { props, present, presentSuccess, presentError, presentWarning, presentInfo, dismiss, visible };
}

export function StatusAlert(props: ReturnType<typeof useStatusAlert>['props']) {
  return <ConfirmAlert {...props} />;
}

const styles = StyleSheet.create({
  iconOuter: {
    alignItems: 'center',
    marginBottom: 4,
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPressed: {
    opacity: 0.82,
  },
});

import { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  SvgThemeDark,
  SvgThemeLight,
  SvgThemeSystem,
} from '@src/components/icons/ThemePreferenceIcons';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { ThemePreference } from '@src/storage/themeStorage';
import type { AppThemeColors } from '@src/theme/palettes';

type Props = {
  visible: boolean;
  title: string;
  cancelLabel: string;
  labels: {
    light: string;
    dark: string;
    system: string;
  };
  currentPreference: ThemePreference;
  onDismiss: () => void;
  onSelectTheme: (pref: ThemePreference) => void | Promise<void>;
};

/** Display order: System, Light, Dark. */
const OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
    },
    sheetWrap: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    sheet: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 400,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingTop: 16,
      paddingBottom: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 14,
      paddingHorizontal: 2,
    },
    list: {
      gap: 8,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      gap: 12,
    },
    optionSelected: {
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? '#1e3a5f' : '#eff6ff',
    },
    optionPressed: {
      opacity: 0.92,
    },
    iconSlot: {
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionLabel: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    optionLabelSelected: {
      color: colors.primary,
    },
    cancelBtn: {
      marginTop: 12,
      paddingVertical: 14,
      alignItems: 'center',
      borderRadius: 12,
    },
    cancelBtnPressed: {
      backgroundColor: colors.secondaryButton,
    },
    cancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
  });
}

export function ThemePicker({
  visible,
  title,
  cancelLabel,
  labels,
  currentPreference,
  onDismiss,
  onSelectTheme,
}: Props) {
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView style={styles.safe} edges={['top', 'right', 'left', 'bottom']}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          style={styles.backdrop}
          onPress={onDismiss}
        />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={styles.sheet}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <View style={styles.list}>
              {OPTIONS.map(key => {
                const selected = currentPreference === key;
                const label = labels[key];
                const iconColor = selected ? colors.primary : colors.textMuted;
                const Icon =
                  key === 'system' ? SvgThemeSystem : key === 'light' ? SvgThemeLight : SvgThemeDark;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={label}
                    onPress={() => {
                      void Promise.resolve(onSelectTheme(key)).then(() => {
                        onDismiss();
                      });
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}>
                    <View style={styles.iconSlot}>
                      <Icon size={22} color={iconColor} />
                    </View>
                    <Text
                      style={[styles.optionLabel, selected && styles.optionLabelSelected]}
                      numberOfLines={2}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onDismiss}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

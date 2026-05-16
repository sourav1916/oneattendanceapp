import { useMemo } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppLanguage } from '@src/i18n/languages';
import { SUPPORTED_LANGUAGES } from '@src/i18n/languages';
import type { AppThemeColors } from '@src/theme/palettes';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = Math.min(SCREEN_HEIGHT * 0.78, 560);

const GAP = 10;

type Props = {
  visible: boolean;
  title: string;
  cancelLabel: string;
  currentLanguage: string;
  onDismiss: () => void;
  onSelectLanguage: (lang: AppLanguage) => void | Promise<void>;
};

function chunkPairs<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

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
      overflow: 'hidden',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 14,
      paddingHorizontal: 2,
    },
    scroll: {
      flexGrow: 0,
    },
    scrollContent: {
      paddingBottom: 4,
    },
    row: {
      flexDirection: 'row',
      gap: GAP,
      marginBottom: GAP,
    },
    cell: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    cellSpacer: {
      flex: 1,
      minWidth: 0,
    },
    cellSelected: {
      borderColor: colors.primary,
      backgroundColor: scheme === 'dark' ? '#1e3a5f' : '#eff6ff',
    },
    cellPressed: {
      opacity: 0.92,
    },
    cellNative: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    cellNativeSelected: {
      color: colors.primary,
    },
    cellEnglish: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textMuted,
    },
    cancelBtn: {
      marginTop: 8,
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

export function LanguagePicker({
  visible,
  title,
  cancelLabel,
  currentLanguage,
  onDismiss,
  onSelectLanguage,
}: Props) {
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const rows = useMemo(() => chunkPairs(SUPPORTED_LANGUAGES), []);

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
          <View style={[styles.sheet, { maxHeight: SHEET_MAX_HEIGHT }]}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}
              bounces={false}>
              {rows.map((pair, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.row}>
                  {pair.map(lang => {
                    const selected = currentLanguage === lang.id;
                    return (
                      <Pressable
                        key={lang.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${lang.english}, ${lang.native}`}
                        onPress={() => {
                          void Promise.resolve(onSelectLanguage(lang.id)).then(() => {
                            onDismiss();
                          });
                        }}
                        style={({ pressed }) => [
                          styles.cell,
                          selected && styles.cellSelected,
                          pressed && styles.cellPressed,
                        ]}>
                        <Text
                          style={[styles.cellNative, selected && styles.cellNativeSelected]}
                          numberOfLines={1}>
                          {lang.native}
                        </Text>
                        <Text style={styles.cellEnglish} numberOfLines={1}>
                          {lang.english}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {pair.length === 1 ? <View style={styles.cellSpacer} /> : null}
                </View>
              ))}
            </ScrollView>
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

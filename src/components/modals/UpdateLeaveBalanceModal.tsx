import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type { EmpLeaveBalanceEmployee, EmpLeaveBalanceType } from '@src/types/empLeaveBalance';
import { coerceLeaveDays, formatLeaveDays } from '@src/utils/formatLeaveDays';

const T = 'home.leaveBalances.updateModal.';
const KEYBOARD_GAP = 8;
const MIN_SHEET_HEIGHT = 280;

function resolveSheetLayout(
  windowHeight: number,
  keyboardHeight: number,
  topInset: number,
): { wrapStyle: ViewStyle; sheetHeight?: number; sheetMaxHeight: number } {
  const keyboardOpen = keyboardHeight > 0;
  const sheetMaxHeight = Math.min(windowHeight * 0.92, windowHeight - topInset - 24);

  if (keyboardOpen) {
    const available = windowHeight - keyboardHeight - KEYBOARD_GAP - topInset;
    const sheetHeight = Math.max(MIN_SHEET_HEIGHT, Math.min(sheetMaxHeight, available));
    return {
      wrapStyle: { justifyContent: 'flex-end', paddingTop: 24, paddingBottom: keyboardHeight },
      sheetHeight,
      sheetMaxHeight,
    };
  }

  return {
    wrapStyle: { justifyContent: 'flex-end', paddingTop: 48, paddingBottom: 0 },
    sheetMaxHeight,
  };
}

export type UpdateLeaveBalanceModalProps = {
  visible: boolean;
  employee: EmpLeaveBalanceEmployee | null;
  leave: EmpLeaveBalanceType | null;
  submitting: boolean;
  onDismiss: () => void;
  onSubmit: (totalAllocated: number) => void;
};

function parseAllocated(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return Math.round(n * 100) / 100;
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const cardBg = scheme === 'dark' ? colors.background : '#f8fafc';
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.overlay },
    backdrop: { ...StyleSheet.absoluteFill },
    sheetWrap: { flex: 1 },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: colors.border,
      flexDirection: 'column',
      overflow: 'hidden',
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginTop: 10,
      marginBottom: 8,
    },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
    scroll: { flexGrow: 0, flexShrink: 1 },
    scrollKeyboardOpen: { flex: 1, minHeight: 0 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
    hint: { fontSize: 12, color: colors.textMuted, marginBottom: 12, lineHeight: 17 },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: cardBg,
    },
    inputError: { borderColor: colors.danger },
    error: { fontSize: 12, color: colors.danger, marginTop: 6 },
    footer: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    btnSecondary: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    btnPrimary: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    btnSecondaryLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    btnPrimaryLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
    btnDisabled: { opacity: 0.55 },
  });
}

export function UpdateLeaveBalanceModal({
  visible,
  employee,
  leave,
  submitting,
  onDismiss,
  onSubmit,
}: UpdateLeaveBalanceModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const [allocated, setAllocated] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const layout = useMemo(
    () => resolveSheetLayout(windowHeight, keyboardHeight, insets.top),
    [insets.top, keyboardHeight, windowHeight],
  );

  const sheetSizeStyle = useMemo(
    (): ViewStyle => ({
      maxHeight: layout.sheetMaxHeight,
      ...(layout.sheetHeight != null ? { height: layout.sheetHeight } : null),
    }),
    [layout.sheetHeight, layout.sheetMaxHeight],
  );

  const usedDays = leave != null ? coerceLeaveDays(leave.used) : 0;
  const maxBalance =
    leave?.max_balance != null ? coerceLeaveDays(leave.max_balance) : null;

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, e => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (visible && leave) {
      setAllocated(formatLeaveDays(leave.total_allocated));
      setError(null);
    }
  }, [visible, leave]);

  const handleSubmit = useCallback(() => {
    if (!leave) {
      return;
    }
    const value = parseAllocated(allocated);
    if (value == null) {
      setError(t(`${T}errors.invalidAllocated`));
      return;
    }
    if (value < usedDays) {
      setError(t(`${T}errors.belowUsed`, { used: formatLeaveDays(usedDays) }));
      return;
    }
    if (maxBalance != null && value > maxBalance) {
      setError(t(`${T}errors.aboveMax`, { max: formatLeaveDays(maxBalance) }));
      return;
    }
    setError(null);
    onSubmit(value);
  }, [allocated, leave, maxBalance, onSubmit, t, usedDays]);

  if (!visible || !employee || !leave) {
    return null;
  }

  const leaveCode = leave.type?.trim() || (leave as { code?: string }).code?.trim() || '';
  const maxHint =
    maxBalance != null ? t(`${T}maxHint`, { max: formatLeaveDays(maxBalance) }) : null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel={t('modals.common.closeDialog')}
          onPress={onDismiss}
        />
        <View style={[styles.sheetWrap, layout.wrapStyle]} pointerEvents="box-none">
          <View style={[styles.sheet, sheetSizeStyle]} accessibilityViewIsModal>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>{t(`${T}title`)}</Text>
              <Text style={styles.subtitle}>
                {employee.employee_name} · {leave.name}
                {leaveCode ? ` (${leaveCode})` : ''}
              </Text>
            </View>

            <ScrollView
              style={[styles.scroll, keyboardHeight > 0 && styles.scrollKeyboardOpen]}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: Math.max(12, insets.bottom) },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={keyboardHeight > 0}
              bounces={false}>
              <Text style={styles.hint}>
                {t(`${T}usedHint`, { used: formatLeaveDays(usedDays) })}
                {maxHint ? ` · ${maxHint}` : ''}
              </Text>
              <Text style={styles.label}>{t(`${T}allocatedLabel`)}</Text>
              <TextInput
                value={allocated}
                onChangeText={setAllocated}
                keyboardType="decimal-pad"
                placeholder={t(`${T}allocatedPlaceholder`)}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, error ? styles.inputError : null]}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={onDismiss}
                style={[styles.btnSecondary, submitting && styles.btnDisabled]}>
                <Text style={styles.btnSecondaryLabel}>{t(`${T}cancel`)}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={handleSubmit}
                style={[styles.btnPrimary, submitting && styles.btnDisabled]}>
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnPrimaryLabel}>{t(`${T}submit`)}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

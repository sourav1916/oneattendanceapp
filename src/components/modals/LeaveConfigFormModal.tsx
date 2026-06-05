import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
  CompanyLeaveConfig,
  CreateLeaveConfigPayload,
  UpdateLeaveConfigPayload,
} from '@src/types/leaveConfig';
import { formatLeaveDays } from '@src/utils/formatLeaveDays';

const T = 'home.leaveConfig.formModal.';
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

export type LeaveConfigFormModalProps = {
  visible: boolean;
  mode: 'create' | 'edit';
  config: CompanyLeaveConfig | null;
  submitting: boolean;
  onDismiss: () => void;
  onSubmitCreate: (payload: CreateLeaveConfigPayload) => void;
  onSubmitUpdate: (payload: UpdateLeaveConfigPayload) => void;
};

function parseOptionalDays(value: string): number | null {
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

function parseRequiredDays(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
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
    subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
    scroll: { flexGrow: 0, flexShrink: 1 },
    scrollKeyboardOpen: { flex: 1, minHeight: 0 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
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
      marginBottom: 14,
    },
    inputError: { borderColor: colors.danger },
    hint: { fontSize: 11, color: colors.textMuted, marginTop: -10, marginBottom: 14 },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      marginBottom: 4,
    },
    switchLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, marginRight: 12 },
    error: { fontSize: 12, color: colors.danger, marginBottom: 8 },
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
      backgroundColor: '#7c3aed',
    },
    btnSecondaryLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    btnPrimaryLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
    btnDisabled: { opacity: 0.55 },
  });
}

export function LeaveConfigFormModal({
  visible,
  mode,
  config,
  submitting,
  onDismiss,
  onSubmitCreate,
  onSubmitUpdate,
}: LeaveConfigFormModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isPaid, setIsPaid] = useState(true);
  const [allowHalfDay, setAllowHalfDay] = useState(false);
  const [maxBalance, setMaxBalance] = useState('');
  const [carryForward, setCarryForward] = useState('0');
  const [excludeWeekends, setExcludeWeekends] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const wasVisibleRef = useRef(false);

  const layout = useMemo(
    () => resolveSheetLayout(windowHeight, keyboardHeight, insets.top),
    [insets.top, keyboardHeight, windowHeight],
  );

  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );

  const sheetSizeStyle = useMemo(
    (): ViewStyle => ({
      maxHeight: layout.sheetMaxHeight,
      ...(layout.sheetHeight != null ? { height: layout.sheetHeight } : null),
    }),
    [layout.sheetHeight, layout.sheetMaxHeight],
  );

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

  const scrollToFocusedField = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    if (wasVisibleRef.current) {
      return;
    }
    wasVisibleRef.current = true;

    if (mode === 'edit' && config) {
      setCode(config.code);
      setName(config.name);
      setIsPaid(config.is_paid);
      setAllowHalfDay(config.allow_half_day);
      setMaxBalance(config.max_balance != null ? formatLeaveDays(config.max_balance) : '');
      setCarryForward(formatLeaveDays(config.carry_forward_limit));
      setExcludeWeekends(config.exclude_weekends);
      setIsActive(config.is_active);
    } else {
      setCode('');
      setName('');
      setIsPaid(true);
      setAllowHalfDay(false);
      setMaxBalance('');
      setCarryForward('0');
      setExcludeWeekends(true);
      setIsActive(true);
    }
    setError(null);
  }, [visible, mode, config]);

  const validate = useCallback((): string | null => {
    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    if (mode === 'create') {
      if (!trimmedCode) {
        return t(`${T}errors.codeRequired`);
      }
      if (trimmedCode.length > 20) {
        return t(`${T}errors.codeTooLong`);
      }
      if (!trimmedName) {
        return t(`${T}errors.nameRequired`);
      }
    } else {
      if (trimmedCode && trimmedCode.length > 20) {
        return t(`${T}errors.codeTooLong`);
      }
      if (trimmedName && trimmedName.length > 50) {
        return t(`${T}errors.nameTooLong`);
      }
    }
    if (maxBalance.trim()) {
      const max = parseOptionalDays(maxBalance);
      if (max == null) {
        return t(`${T}errors.invalidMaxBalance`);
      }
    }
    const carry = parseRequiredDays(carryForward);
    if (carry == null) {
      return t(`${T}errors.invalidCarryForward`);
    }
    return null;
  }, [carryForward, code, maxBalance, mode, name, t]);

  const handleSubmit = useCallback(() => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);

    const maxVal = maxBalance.trim() ? parseOptionalDays(maxBalance) : null;
    const carryVal = parseRequiredDays(carryForward) ?? 0;

    if (mode === 'create') {
      onSubmitCreate({
        code: code.trim(),
        name: name.trim(),
        is_paid: isPaid,
        allow_half_day: allowHalfDay,
        max_balance: maxVal,
        carry_forward_limit: carryVal,
        exclude_weekends: excludeWeekends,
      });
      return;
    }

    if (!config) {
      return;
    }

    const payload: UpdateLeaveConfigPayload = { id: config.id };
    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    if (trimmedCode && trimmedCode !== config.code) {
      payload.code = trimmedCode;
    }
    if (trimmedName && trimmedName !== config.name) {
      payload.name = trimmedName;
    }
    if (isPaid !== config.is_paid) {
      payload.is_paid = isPaid;
    }
    if (allowHalfDay !== config.allow_half_day) {
      payload.allow_half_day = allowHalfDay;
    }
    const prevMax = config.max_balance;
    if (maxVal !== prevMax) {
      payload.max_balance = maxVal;
    }
    if (carryVal !== config.carry_forward_limit) {
      payload.carry_forward_limit = carryVal;
    }
    if (excludeWeekends !== config.exclude_weekends) {
      payload.exclude_weekends = excludeWeekends;
    }
    if (isActive !== config.is_active) {
      payload.is_active = isActive;
    }

    const keys = Object.keys(payload).filter(k => k !== 'id');
    if (keys.length === 0) {
      setError(t(`${T}errors.noChanges`));
      return;
    }

    onSubmitUpdate(payload);
  }, [
    allowHalfDay,
    code,
    config,
    carryForward,
    excludeWeekends,
    isActive,
    isPaid,
    maxBalance,
    mode,
    name,
    onSubmitCreate,
    onSubmitUpdate,
    validate,
    t,
  ]);

  if (!visible) {
    return null;
  }

  const isEdit = mode === 'edit';

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
              <Text style={styles.title}>
                {isEdit ? t(`${T}editTitle`) : t(`${T}createTitle`)}
              </Text>
              <Text style={styles.subtitle}>
                {isEdit ? t(`${T}editSubtitle`) : t(`${T}createSubtitle`)}
              </Text>
            </View>

            <ScrollView
              ref={scrollRef}
              style={[styles.scroll, keyboardHeight > 0 && styles.scrollKeyboardOpen]}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: Math.max(16, insets.bottom) },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={keyboardHeight > 0}
              bounces={false}>
              <Text style={styles.label}>{t(`${T}codeLabel`)}</Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={20}
                placeholder={t(`${T}codePlaceholder`)}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              <Text style={styles.label}>{t(`${T}nameLabel`)}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                maxLength={50}
                placeholder={t(`${T}namePlaceholder`)}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              <Text style={styles.label}>{t(`${T}maxBalanceLabel`)}</Text>
              <TextInput
                value={maxBalance}
                onChangeText={setMaxBalance}
                onFocus={scrollToFocusedField}
                keyboardType="decimal-pad"
                placeholder={t(`${T}maxBalancePlaceholder`)}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
              <Text style={styles.hint}>{t(`${T}maxBalanceHint`)}</Text>

              <Text style={styles.label}>{t(`${T}carryForwardLabel`)}</Text>
              <TextInput
                value={carryForward}
                onChangeText={setCarryForward}
                onFocus={scrollToFocusedField}
                keyboardType="decimal-pad"
                placeholder={t(`${T}carryForwardPlaceholder`)}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t(`${T}isPaidLabel`)}</Text>
                <Switch
                  value={isPaid}
                  onValueChange={setIsPaid}
                  trackColor={{ false: colors.border, true: '#7c3aed' }}
                  thumbColor="#fff"
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t(`${T}allowHalfDayLabel`)}</Text>
                <Switch
                  value={allowHalfDay}
                  onValueChange={setAllowHalfDay}
                  trackColor={{ false: colors.border, true: '#7c3aed' }}
                  thumbColor="#fff"
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t(`${T}excludeWeekendsLabel`)}</Text>
                <Switch
                  value={excludeWeekends}
                  onValueChange={setExcludeWeekends}
                  trackColor={{ false: colors.border, true: '#7c3aed' }}
                  thumbColor="#fff"
                />
              </View>
              {isEdit ? (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{t(`${T}isActiveLabel`)}</Text>
                  <Switch
                    value={isActive}
                    onValueChange={setIsActive}
                    trackColor={{ false: colors.border, true: '#7c3aed' }}
                    thumbColor="#fff"
                  />
                </View>
              ) : null}

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
                  <Text style={styles.btnPrimaryLabel}>
                    {isEdit ? t(`${T}save`) : t(`${T}create`)}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

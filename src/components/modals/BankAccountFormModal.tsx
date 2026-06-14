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
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { bankAccountApi } from '@src/api/bankAccountApi';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import type { BankAccountListItem, EmployeeAccountType } from '@src/types/bankAccount';
import {
  EMPLOYEE_ACCOUNT_TYPES,
  accountTypeLabelKey,
  isValidAccountNumber,
  isValidIfsc,
  isValidUpiId,
  normalizeIfsc,
} from '@src/utils/bankAccountValidation';
import { readApiError } from '@src/utils/readApiError';

type Props = {
  visible: boolean;
  mode: 'create' | 'edit';
  account: BankAccountListItem | null;
  companyId: number;
  employeeId: number;
  onDismiss: () => void;
  onSaved: () => void;
};

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

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const isDark = scheme === 'dark';
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
      backgroundColor: isDark ? '#475569' : '#cbd5e1',
      marginTop: 10,
      marginBottom: 6,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: { fontSize: 18, fontWeight: '800', color: colors.text, flex: 1 },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#334155' : '#f1f5f9',
    },
    scroll: { flexGrow: 0, flexShrink: 1 },
    scrollKeyboardOpen: { flex: 1, minHeight: 0 },
    scrollContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      marginTop: 4,
    },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    typeChip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    typeChipActive: {
      borderColor: colors.primary,
      backgroundColor: isDark ? '#1e3a5f' : '#eff6ff',
    },
    typeChipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
    typeChipTextActive: { color: colors.primary, fontWeight: '700' },
    input: {
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 15,
      color: colors.text,
      marginBottom: 10,
    },
    ifscRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    ifscInput: { flex: 1, marginBottom: 0 },
    lookupHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 10,
      lineHeight: 18,
    },
    lookupSuccess: {
      fontSize: 12,
      color: isDark ? '#86efac' : '#15803d',
      marginBottom: 10,
      lineHeight: 18,
    },
    lookupError: { fontSize: 12, color: colors.danger, marginBottom: 10, lineHeight: 18 },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      marginBottom: 8,
    },
    switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1, paddingRight: 12 },
    switchBody: { flex: 1 },
    switchHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    footer: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    submitBtnPressed: { opacity: 0.9 },
    submitBtnDisabled: { opacity: 0.55 },
    submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    formError: { fontSize: 13, color: colors.danger, marginBottom: 10, lineHeight: 18 },
  });
}

export function BankAccountFormModal({
  visible,
  mode,
  account,
  companyId,
  employeeId,
  onDismiss,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [accountType, setAccountType] = useState<EmployeeAccountType>('savings');
  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscMessage, setIfscMessage] = useState<string | null>(null);
  const [ifscError, setIfscError] = useState<string | null>(null);

  const ifscTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setFormError(null);
    setIfscMessage(null);
    setIfscError(null);
    if (mode === 'edit' && account) {
      setAccountType(account.account_type);
      setBankName(account.bank_name?.trim() ?? '');
      setAccountHolderName(account.account_holder_name?.trim() ?? '');
      setAccountNumber(account.account_number?.trim() ?? '');
      setIfscCode(account.ifsc_code?.trim() ?? '');
      setBranchName(account.branch_name?.trim() ?? '');
      setUpiId(account.upi_id?.trim() ?? '');
      setIsPrimary(account.is_primary);
      return;
    }
    setAccountType('savings');
    setBankName('');
    setAccountHolderName('');
    setAccountNumber('');
    setIfscCode('');
    setBranchName('');
    setUpiId('');
    setIsPrimary(false);
  }, [visible, mode, account]);

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

  const lookupIfsc = useCallback(
    async (raw: string) => {
      const code = normalizeIfsc(raw);
      if (!isValidIfsc(code)) {
        setIfscMessage(null);
        setIfscError(null);
        return;
      }
      setIfscLoading(true);
      setIfscError(null);
      setIfscMessage(null);
      try {
        const res = await bankAccountApi.lookupIfsc(code);
        if (!res.success || !res.data) {
          setIfscError(res.message?.trim() || t('settings.bankAccounts.errors.ifscNotFound'));
          return;
        }
        setBankName(res.data.bank_name?.trim() ?? bankName);
        setBranchName(res.data.branch?.trim() ?? branchName);
        setIfscMessage(
          [res.data.bank_name, res.data.branch, res.data.city].filter(Boolean).join(' · '),
        );
      } catch (e) {
        setIfscError(readApiError(e));
      } finally {
        setIfscLoading(false);
      }
    },
    [bankName, branchName, t],
  );

  useEffect(() => {
    if (!visible || accountType === 'upi') {
      return;
    }
    if (ifscTimerRef.current) {
      clearTimeout(ifscTimerRef.current);
    }
    ifscTimerRef.current = setTimeout(() => {
      lookupIfsc(ifscCode).catch(() => { });
    }, 450);
    return () => {
      if (ifscTimerRef.current) {
        clearTimeout(ifscTimerRef.current);
      }
    };
  }, [accountType, ifscCode, lookupIfsc, visible]);

  const validate = useCallback((): string | null => {
    if (accountType === 'upi') {
      if (!isValidUpiId(upiId)) {
        return t('settings.bankAccounts.errors.invalidUpi');
      }
      return null;
    }
    if (!bankName.trim()) {
      return t('settings.bankAccounts.errors.bankNameRequired');
    }
    if (!accountHolderName.trim()) {
      return t('settings.bankAccounts.errors.holderRequired');
    }
    if (!isValidAccountNumber(accountNumber)) {
      return t('settings.bankAccounts.errors.invalidAccountNumber');
    }
    if (!isValidIfsc(ifscCode)) {
      return t('settings.bankAccounts.errors.invalidIfsc');
    }
    return null;
  }, [accountHolderName, accountNumber, accountType, bankName, ifscCode, t, upiId]);

  const handleSubmit = useCallback(async () => {
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      if (mode === 'edit' && account) {
        const payload =
          accountType === 'upi'
            ? {
              bank_id: account.bank_account_id,
              account_type: accountType,
              upi_id: upiId.trim(),
              is_primary: isPrimary,
            }
            : {
              bank_id: account.bank_account_id,
              account_type: accountType,
              bank_name: bankName.trim(),
              account_holder_name: accountHolderName.trim(),
              account_number: accountNumber.trim(),
              ifsc_code: normalizeIfsc(ifscCode),
              branch_name: branchName.trim() || null,
              upi_id: null,
              is_primary: isPrimary,
            };
        const res = await bankAccountApi.updateAccount(companyId, payload);
        if (!res.success) {
          setFormError(res.message?.trim() || t('settings.bankAccounts.errors.saveFailed'));
          return;
        }
      } else {
        const payload =
          accountType === 'upi'
            ? {
              bank_owner_type: 'employee' as const,
              employee_id: employeeId,
              account_type: accountType,
              upi_id: upiId.trim(),
              is_primary: isPrimary,
            }
            : {
              bank_owner_type: 'employee' as const,
              employee_id: employeeId,
              account_type: accountType,
              bank_name: bankName.trim(),
              account_holder_name: accountHolderName.trim(),
              account_number: accountNumber.trim(),
              ifsc_code: normalizeIfsc(ifscCode),
              branch_name: branchName.trim() || null,
              upi_id: null,
              is_primary: isPrimary,
            };
        const res = await bankAccountApi.createAccount(companyId, payload);
        if (!res.success) {
          setFormError(res.message?.trim() || t('settings.bankAccounts.errors.saveFailed'));
          return;
        }
      }
      onSaved();
      onDismiss();
    } catch (e) {
      setFormError(readApiError(e));
    } finally {
      setSubmitting(false);
    }
  }, [
    account,
    accountHolderName,
    accountNumber,
    accountType,
    bankName,
    branchName,
    companyId,
    employeeId,
    ifscCode,
    isPrimary,
    mode,
    onDismiss,
    onSaved,
    t,
    upiId,
    validate,
  ]);

  const title =
    mode === 'edit'
      ? t('settings.bankAccounts.editTitle')
      : t('settings.bankAccounts.addTitle');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="button" />
        <View style={[styles.sheetWrap, layout.wrapStyle]} pointerEvents="box-none">
          <View style={[styles.sheet, sheetSizeStyle]} accessibilityViewIsModal>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable
                onPress={onDismiss}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel={t('settings.bankAccounts.close')}>
                <MaterialCommunityIcons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={[styles.scroll, keyboardHeight > 0 && styles.scrollKeyboardOpen]}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: Math.max(8, insets.bottom) },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator={keyboardHeight > 0}
              bounces={false}>
              {formError ? <Text style={styles.formError}>{formError}</Text> : null}

              <Text style={styles.label}>{t('settings.bankAccounts.accountTypeLabel')}</Text>
              <View style={styles.typeRow}>
                {EMPLOYEE_ACCOUNT_TYPES.map(type => {
                  const active = accountType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setAccountType(type)}
                      style={[styles.typeChip, active && styles.typeChipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}>
                      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                        {t(accountTypeLabelKey(type))}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {accountType === 'upi' ? (
                <>
                  <Text style={styles.label}>{t('settings.bankAccounts.upiIdLabel')}</Text>
                  <TextInput
                    value={upiId}
                    onChangeText={setUpiId}
                    placeholder={t('settings.bankAccounts.upiIdPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.label}>{t('settings.bankAccounts.ifscLabel')}</Text>
                  <View style={styles.ifscRow}>
                    <TextInput
                      value={ifscCode}
                      onChangeText={v => setIfscCode(v.toUpperCase())}
                      placeholder="SBIN0001234"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={11}
                      style={[styles.input, styles.ifscInput]}
                    />
                    {ifscLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                  </View>
                  {ifscMessage ? <Text style={styles.lookupSuccess}>{ifscMessage}</Text> : null}
                  {ifscError ? <Text style={styles.lookupError}>{ifscError}</Text> : null}
                  {!ifscMessage && !ifscError ? (
                    <Text style={styles.lookupHint}>{t('settings.bankAccounts.ifscHint')}</Text>
                  ) : null}

                  <Text style={styles.label}>{t('settings.bankAccounts.bankNameLabel')}</Text>
                  <TextInput
                    value={bankName}
                    onChangeText={setBankName}
                    placeholder={t('settings.bankAccounts.bankNamePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                  />

                  <Text style={styles.label}>{t('settings.bankAccounts.branchLabel')}</Text>
                  <TextInput
                    value={branchName}
                    onChangeText={setBranchName}
                    placeholder={t('settings.bankAccounts.branchPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                  />

                  <Text style={styles.label}>{t('settings.bankAccounts.holderLabel')}</Text>
                  <TextInput
                    value={accountHolderName}
                    onChangeText={setAccountHolderName}
                    placeholder={t('settings.bankAccounts.holderPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    style={styles.input}
                  />

                  <Text style={styles.label}>{t('settings.bankAccounts.accountNumberLabel')}</Text>
                  <TextInput
                    value={accountNumber}
                    onChangeText={setAccountNumber}
                    placeholder={t('settings.bankAccounts.accountNumberPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </>
              )}

              <View style={styles.switchRow}>
                <View style={styles.switchBody}>
                  <Text style={styles.switchLabel}>{t('settings.bankAccounts.primaryLabel')}</Text>
                  <Text style={styles.switchHint}>{t('settings.bankAccounts.primaryHint')}</Text>
                </View>
                <Switch
                  value={isPrimary}
                  onValueChange={setIsPrimary}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
              <Pressable
                onPress={() => {
                  handleSubmit().catch(() => { });
                }}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.submitBtn,
                  pressed && !submitting && styles.submitBtnPressed,
                  submitting && styles.submitBtnDisabled,
                ]}
                accessibilityRole="button">
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitText}>
                    {mode === 'edit'
                      ? t('settings.bankAccounts.saveChanges')
                      : t('settings.bankAccounts.addAccount')}
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

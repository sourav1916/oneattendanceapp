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
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  requestUpdatePhoneOtp,
  UpdatePhoneError,
  verifyUpdatePhoneOtp,
} from '@src/api/updatePhone';
import { CountryCodePicker } from '@src/components/modals/CountryCodePicker';
import { StatusAlert, useStatusAlert } from '@src/components/modals/StatusAlert';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import { isValidNationalMobile } from '@src/utils/loginIdentifier';
import {
  combinePhoneDigits,
  DEFAULT_LOGIN_COUNTRY,
  formatPhoneDisplay,
  resolveCountryAndNationalFromDigits,
  type LoginCountry,
} from '@src/utils/loginCountries';
import { onlyDigits } from '@src/utils/profileEditForm';
import { readApiError } from '@src/utils/readApiError';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 30;
const SHEET_HEIGHT_CAP = 420;
const MIN_SHEET_HEIGHT = 200;
const SHEET_MAX_HEIGHT_RATIO = 0.58;
const CELL_SIZE = Platform.OS === 'ios' ? 44 : 42;

type Step = 'phone' | 'otp';

type Props = {
  visible: boolean;
  currentPhoneDigits: string;
  registeredEmail?: string;
  onDismiss: () => void;
};

function resolveSheetLayout(
  windowHeight: number,
  keyboardHeight: number,
  topInset: number,
  bottomInset: number,
): { wrapStyle: ViewStyle; sheetMaxHeight: number; fixedSheetHeight?: number } {
  const keyboardOpen = keyboardHeight > 0;
  const topGap = topInset + 8;
  const keyboardGap = 8;
  const sheetMaxHeight = Math.min(
    SHEET_HEIGHT_CAP,
    Math.max(MIN_SHEET_HEIGHT, windowHeight * SHEET_MAX_HEIGHT_RATIO),
  );

  if (keyboardOpen) {
    const spaceAboveKeyboard = windowHeight - keyboardHeight - keyboardGap;
    const fixedSheetHeight = Math.max(
      MIN_SHEET_HEIGHT,
      Math.min(SHEET_HEIGHT_CAP, spaceAboveKeyboard - topGap),
    );
    return {
      wrapStyle: { justifyContent: 'flex-start', paddingTop: topGap, paddingBottom: 0 },
      sheetMaxHeight,
      fixedSheetHeight,
    };
  }

  return {
    wrapStyle: {
      justifyContent: 'center',
      paddingTop: 0,
      paddingBottom: Math.max(bottomInset, 10),
    },
    sheetMaxHeight,
  };
}

function maskEmail(email: string): string {
  const t = email.trim();
  const at = t.indexOf('@');
  if (at <= 1) {
    return t;
  }
  const local = t.slice(0, at);
  const domain = t.slice(at);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'•'.repeat(Math.max(1, local.length - visible.length))}${domain}`;
}

function buildStyles(
  colors: AppThemeColors,
  scheme: 'light' | 'dark',
  sheetMaxHeight: number,
  fixedSheetHeight?: number,
) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.overlay },
    backdrop: { ...StyleSheet.absoluteFill },
    sheetWrap: { flex: 1, paddingHorizontal: 16 },
    sheet: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 420,
      maxHeight: sheetMaxHeight,
      ...(fixedSheetHeight != null
        ? { height: fixedSheetHeight, maxHeight: fixedSheetHeight }
        : null),
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 8,
    },
    headerBack: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerBackPressed: { opacity: 0.7 },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: fixedSheetHeight != null ? { flex: 1 } : {},
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 14,
      flexGrow: 0,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 22,
      marginBottom: 12,
    },
    subtitleAccent: { color: colors.text, fontWeight: '600' },
    currentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    currentLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    currentValue: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 12,
      padding: 12,
      borderRadius: 10,
      backgroundColor: scheme === 'dark' ? '#450a0a' : '#fef2f2',
      borderWidth: 1,
      borderColor: scheme === 'dark' ? '#7f1d1d' : '#fecaca',
    },
    errorText: {
      flex: 1,
      fontSize: 14,
      color: colors.danger,
      lineHeight: 20,
    },
    label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      minHeight: Platform.OS === 'ios' ? 48 : 44,
      fontSize: 15,
      color: colors.text,
      marginBottom: 8,
    },
    primaryBtn: {
      marginTop: 4,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    primaryBtnDisabled: { opacity: 0.55 },
    primaryBtnPressed: { backgroundColor: colors.primaryPressed },
    primaryBtnLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
    otpRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 6,
      marginBottom: 12,
    },
    otpCell: {
      flex: 1,
      height: CELL_SIZE,
      maxWidth: 48,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 0,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    },
    resendBtn: {
      alignSelf: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginTop: 4,
    },
    resendText: { fontSize: 15, fontWeight: '600', color: colors.primary },
    resendTextDisabled: { color: colors.textMuted },
    mobileRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
    countrySelectBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      minWidth: 88,
      paddingHorizontal: 10,
      marginBottom: 0,
    },
    countrySelectCode: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    phoneNumberInput: { flex: 1, marginBottom: 0 },
  });
}

export function ChangePhoneModal({
  visible,
  currentPhoneDigits,
  registeredEmail = '',
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { applySessionFromProfileUpdate, refreshProfileRole } = useAuth();
  const { props: statusAlertProps, presentSuccess } = useStatusAlert();

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('phone');
  const [selectedCountry, setSelectedCountry] = useState<LoginCountry>(DEFAULT_LOGIN_COUNTRY);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [phoneNational, setPhoneNational] = useState('');
  const [pendingPhone, setPendingPhone] = useState('');
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(''));
  const [requestLoading, setRequestLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const otpInputsRef = useRef<Array<TextInput | null>>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const layout = useMemo(
    () => resolveSheetLayout(windowHeight, keyboardHeight, insets.top, insets.bottom),
    [windowHeight, keyboardHeight, insets.top, insets.bottom],
  );

  const styles = useMemo(
    () => buildStyles(colors, resolvedScheme, layout.sheetMaxHeight, layout.fixedSheetHeight),
    [colors, resolvedScheme, layout.fixedSheetHeight, layout.sheetMaxHeight],
  );

  const clearCooldownTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startCooldownTimer = useCallback(() => {
    clearCooldownTimer();
    setSecondsLeft(RESEND_COOLDOWN_SEC);
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearCooldownTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearCooldownTimer]);

  const resetState = useCallback(() => {
    clearCooldownTimer();
    setStep('phone');
    setSelectedCountry(DEFAULT_LOGIN_COUNTRY);
    setCountryPickerOpen(false);
    setPhoneNational('');
    setPendingPhone('');
    setDigits(Array(OTP_LENGTH).fill(''));
    setFormError(null);
    setRequestLoading(false);
    setVerifyLoading(false);
    setResendLoading(false);
    setSecondsLeft(0);
    setKeyboardHeight(0);
  }, [clearCooldownTimer]);

  useEffect(() => {
    if (!visible) {
      resetState();
    }
  }, [visible, resetState]);

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

  useEffect(() => () => clearCooldownTimer(), [clearCooldownTimer]);

  const mapPhoneError = useCallback(
    (err: unknown): string => {
      if (err instanceof UpdatePhoneError) {
        if (err.needsRegisteredEmail) {
          return t('settings.profile.changePhone.errors.emailRequired');
        }
        if (err.isDuplicatePhone) {
          return (
            err.message.trim() ||
            t('settings.profile.changePhone.errors.duplicatePhone')
          );
        }
        return err.message;
      }
      return readApiError(err);
    },
    [t],
  );

  const showInlineError = useCallback((message: string) => {
    setFormError(message);
  }, []);

  const showPhoneSuccess = useCallback(
    (apiMessage: string) => {
      presentSuccess({
        title: t('settings.profile.changePhone.successTitle'),
        message: apiMessage.trim() || t('settings.profile.changePhone.successMessage'),
        showMessage: true,
        buttonText: t('settings.profile.successButton'),
        dismissIconA11y: t('settings.profile.successDismissA11y'),
        onAfterDismiss: onDismiss,
      });
    },
    [onDismiss, presentSuccess, t],
  );

  const currentPhoneParsed = useMemo(
    () => resolveCountryAndNationalFromDigits(currentPhoneDigits),
    [currentPhoneDigits],
  );

  const currentPhoneDisplay = useMemo(() => {
    if (!currentPhoneDigits) {
      return '';
    }
    return formatPhoneDisplay(currentPhoneParsed.country, currentPhoneParsed.national);
  }, [currentPhoneDigits, currentPhoneParsed]);

  const pendingPhoneDisplay = useMemo(() => {
    if (!pendingPhone) {
      return '';
    }
    const parsed = resolveCountryAndNationalFromDigits(pendingPhone);
    return formatPhoneDisplay(parsed.country, parsed.national);
  }, [pendingPhone]);

  const validateNewPhone = useCallback((): string | null => {
    const national = onlyDigits(phoneNational);
    if (!isValidNationalMobile(national)) {
      return t('settings.profile.changePhone.errors.invalidPhone');
    }
    const combined = combinePhoneDigits(selectedCountry, national);
    if (combined.length < 10) {
      return t('settings.profile.changePhone.errors.invalidPhone');
    }
    if (combined === onlyDigits(currentPhoneDigits)) {
      return t('settings.profile.changePhone.errors.sameAsCurrent');
    }
    return null;
  }, [currentPhoneDigits, phoneNational, selectedCountry, t]);

  const handleRequestOtp = useCallback(async () => {
    const validationErr = validateNewPhone();
    if (validationErr) {
      showInlineError(validationErr);
      return;
    }
    const normalized = combinePhoneDigits(selectedCountry, phoneNational);
    setFormError(null);
    setRequestLoading(true);
    try {
      await requestUpdatePhoneOtp(normalized);
      setPendingPhone(normalized);
      setDigits(Array(OTP_LENGTH).fill(''));
      setStep('otp');
      startCooldownTimer();
    } catch (err) {
      if (err instanceof UpdatePhoneError && err.isRateLimited) {
        startCooldownTimer();
      }
      showInlineError(mapPhoneError(err));
    } finally {
      setRequestLoading(false);
    }
  }, [
    mapPhoneError,
    phoneNational,
    selectedCountry,
    showInlineError,
    startCooldownTimer,
    validateNewPhone,
  ]);

  const handleResendOtp = useCallback(async () => {
    if (secondsLeft > 0 || resendLoading || !pendingPhone) {
      return;
    }
    setResendLoading(true);
    try {
      await requestUpdatePhoneOtp(pendingPhone);
      setDigits(Array(OTP_LENGTH).fill(''));
      startCooldownTimer();
    } catch (err) {
      if (err instanceof UpdatePhoneError && err.isRateLimited) {
        startCooldownTimer();
      }
      showInlineError(mapPhoneError(err));
    } finally {
      setResendLoading(false);
    }
  }, [mapPhoneError, pendingPhone, resendLoading, secondsLeft, showInlineError, startCooldownTimer]);

  const setDigitAt = useCallback((index: number, value: string) => {
    setDigits(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const focusOtpInput = useCallback((index: number) => {
    setTimeout(() => otpInputsRef.current[index]?.focus(), 0);
  }, []);

  const handleOtpChange = useCallback(
    (text: string, index: number) => {
      const numeric = text.replace(/\D/g, '');
      if (numeric.length > 1) {
        const chars = numeric.slice(0, OTP_LENGTH).split('');
        setDigits(prev => {
          const next = [...prev];
          for (let i = 0; i < chars.length && index + i < OTP_LENGTH; i++) {
            next[index + i] = chars[i] ?? '';
          }
          return next;
        });
        focusOtpInput(Math.min(index + chars.length, OTP_LENGTH - 1));
        return;
      }
      if (numeric.length === 0) {
        const had = digits[index] !== '';
        setDigitAt(index, '');
        if (had && index > 0) {
          focusOtpInput(index - 1);
        }
        return;
      }
      const digit = numeric.slice(-1);
      setDigitAt(index, digit);
      if (digit && index < OTP_LENGTH - 1) {
        focusOtpInput(index + 1);
      }
    },
    [digits, focusOtpInput, setDigitAt],
  );

  const handleOtpKeyPress = useCallback(
    (key: string, index: number) => {
      if (key !== 'Backspace' || index <= 0) {
        return;
      }
      if (digits[index] === '') {
        focusOtpInput(index - 1);
      }
    },
    [digits, focusOtpInput],
  );

  const handleVerify = useCallback(async () => {
    const otp = digits.join('');
    if (otp.length !== OTP_LENGTH || verifyLoading || !pendingPhone) {
      return;
    }
    setVerifyLoading(true);
    try {
      const { message, phone } = await verifyUpdatePhoneOtp(pendingPhone, otp);
      await applySessionFromProfileUpdate({ phone });
      try {
        await refreshProfileRole({ silent: true });
      } catch {
        /* profile saved */
      }
      showPhoneSuccess(message);
    } catch (err) {
      showInlineError(mapPhoneError(err));
    } finally {
      setVerifyLoading(false);
    }
  }, [
    applySessionFromProfileUpdate,
    digits,
    mapPhoneError,
    pendingPhone,
    refreshProfileRole,
    showInlineError,
    showPhoneSuccess,
    verifyLoading,
  ]);

  const goBackToPhone = useCallback(() => {
    setStep('phone');
    setDigits(Array(OTP_LENGTH).fill(''));
    setFormError(null);
    if (pendingPhone) {
      const parsed = resolveCountryAndNationalFromDigits(pendingPhone);
      setSelectedCountry(parsed.country);
      setPhoneNational(parsed.national);
    }
  }, [pendingPhone]);

  const codeComplete = digits.every(d => d.length === 1);
  const resendBlocked = secondsLeft > 0 || resendLoading;
  const emailForCopy = registeredEmail.trim();
  const maskedEmail = emailForCopy ? maskEmail(emailForCopy) : '';

  return (
    <>
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}>
      <SafeAreaView style={styles.safe} edges={['top', 'right', 'left', 'bottom']}>
        <View style={styles.backdrop} pointerEvents="none" />
        <View style={[styles.sheetWrap, layout.wrapStyle]} pointerEvents="box-none">
          <View style={styles.sheet}>
            <View style={styles.header}>
              {step === 'otp' ? (
                <Pressable
                  onPress={goBackToPhone}
                  style={({ pressed }) => [styles.headerBack, pressed && styles.headerBackPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.profile.changePhone.backToPhone')}>
                  <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                </Pressable>
              ) : (
                <View style={styles.headerBack} />
              )}
              <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
                {step === 'phone'
                  ? t('settings.profile.changePhone.title')
                  : t('settings.profile.changePhone.otpTitle')}
              </Text>
              <Pressable
                onPress={onDismiss}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.headerBackPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('settings.profile.changePhone.cancel')}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
              showsVerticalScrollIndicator={false}
              bounces={false}>
              {step === 'phone' ? (
                <>
                  <Text style={styles.subtitle}>
                    {t('settings.profile.changePhone.phoneSubtitle')}
                  </Text>
                  {currentPhoneDigits ? (
                    <View style={styles.currentRow}>
                      <MaterialCommunityIcons
                        name="phone-outline"
                        size={20}
                        color={colors.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.currentLabel}>
                          {t('settings.profile.changePhone.currentLabel')}
                        </Text>
                        <Text style={styles.currentValue}>
                          {currentPhoneDisplay || currentPhoneDigits}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  <Text style={styles.label}>{t('settings.profile.changePhone.newPhoneLabel')}</Text>
                  <View style={styles.mobileRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Country code ${selectedCountry.dialCode}, ${selectedCountry.name}`}
                      onPress={() => {
                        setFormError(null);
                        setCountryPickerOpen(true);
                      }}
                      style={({ pressed }) => [
                        styles.input,
                        styles.countrySelectBtn,
                        pressed && { opacity: 0.88 },
                      ]}>
                      <Text style={styles.countrySelectCode}>{selectedCountry.dialCode}</Text>
                      <MaterialCommunityIcons
                        name="chevron-down"
                        size={20}
                        color={colors.textMuted}
                      />
                    </Pressable>
                    <TextInput
                      style={[styles.input, styles.phoneNumberInput]}
                      value={phoneNational}
                      onChangeText={v => {
                        setFormError(null);
                        setPhoneNational(onlyDigits(v));
                      }}
                      placeholder={t('settings.profile.phonePlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      maxLength={15}
                    />
                  </View>
                  {formError ? (
                    <View style={styles.errorBanner} accessibilityLiveRegion="polite">
                      <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={18}
                        color={colors.danger}
                      />
                      <Text style={styles.errorText}>{formError}</Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => {
                      handleRequestOtp().catch(() => {});
                    }}
                    disabled={requestLoading}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      requestLoading && styles.primaryBtnDisabled,
                      pressed && !requestLoading && styles.primaryBtnPressed,
                    ]}
                    accessibilityRole="button">
                    {requestLoading ? <ActivityIndicator color="#fff" /> : null}
                    <Text style={styles.primaryBtnLabel}>
                      {requestLoading
                        ? t('settings.profile.changePhone.sending')
                        : t('settings.profile.changePhone.continue')}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.subtitle}>
                    {t('settings.profile.changePhone.otpSubtitle')}{' '}
                    {maskedEmail ? (
                      <Text style={styles.subtitleAccent}>{maskedEmail}</Text>
                    ) : (
                      t('settings.profile.changePhone.otpSubtitleFallback')
                    )}
                  </Text>
                  <Text style={[styles.label, { marginBottom: 12 }]}>
                    {t('settings.profile.changePhone.otpLabel', {
                      phone: pendingPhoneDisplay || pendingPhone,
                    })}
                  </Text>
                  <View style={styles.otpRow} accessibilityRole="none">
                    {digits.map((d, index) => (
                      <TextInput
                        key={index}
                        ref={el => {
                          otpInputsRef.current[index] = el;
                        }}
                        value={d}
                        onChangeText={text => {
                          setFormError(null);
                          handleOtpChange(text, index);
                        }}
                        onKeyPress={({ nativeEvent }) =>
                          handleOtpKeyPress(nativeEvent.key, index)
                        }
                        keyboardType="number-pad"
                        inputMode="numeric"
                        selectTextOnFocus
                        caretHidden={Platform.OS === 'android'}
                        style={styles.otpCell}
                        placeholder="·"
                        placeholderTextColor={colors.textMuted}
                      />
                    ))}
                  </View>
                  {formError ? (
                    <View style={styles.errorBanner} accessibilityLiveRegion="polite">
                      <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={18}
                        color={colors.danger}
                      />
                      <Text style={styles.errorText}>{formError}</Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => {
                      handleVerify().catch(() => {});
                    }}
                    disabled={!codeComplete || verifyLoading}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      (!codeComplete || verifyLoading) && styles.primaryBtnDisabled,
                      pressed && codeComplete && !verifyLoading && styles.primaryBtnPressed,
                    ]}
                    accessibilityRole="button">
                    {verifyLoading ? <ActivityIndicator color="#fff" /> : null}
                    <Text style={styles.primaryBtnLabel}>
                      {verifyLoading
                        ? t('settings.profile.changePhone.verifying')
                        : t('settings.profile.changePhone.verify')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      handleResendOtp().catch(() => {});
                    }}
                    disabled={resendBlocked}
                    style={styles.resendBtn}
                    accessibilityRole="button">
                    {resendLoading ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Text
                        style={[
                          styles.resendText,
                          resendBlocked && styles.resendTextDisabled,
                        ]}>
                        {secondsLeft > 0
                          ? t('settings.profile.changePhone.resendIn', { seconds: secondsLeft })
                          : t('settings.profile.changePhone.resend')}
                      </Text>
                    )}
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>

    </Modal>

    <CountryCodePicker
      visible={countryPickerOpen}
      selectedCountryCode={selectedCountry.code}
      onDismiss={() => setCountryPickerOpen(false)}
      onSelectCountry={country => {
        setSelectedCountry(country);
        setCountryPickerOpen(false);
      }}
    />

    <StatusAlert {...statusAlertProps} />
    </>
  );
}

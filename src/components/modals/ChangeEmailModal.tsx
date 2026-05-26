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
  requestUpdateEmailOtp,
  UpdateEmailError,
  verifyUpdateEmailOtp,
} from '@src/api/updateEmail';
import { StatusAlert, useStatusAlert } from '@src/components/modals/StatusAlert';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import { onlyDigits } from '@src/utils/profileEditForm';
import { isValidEmail } from '@src/utils/loginIdentifier';
import { readApiError } from '@src/utils/readApiError';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 30;
const SHEET_HEIGHT_CAP = 420;
const MIN_SHEET_HEIGHT = 200;
const SHEET_MAX_HEIGHT_RATIO = 0.58;
const CELL_SIZE = Platform.OS === 'ios' ? 44 : 42;

type Step = 'email' | 'otp';

type Props = {
  visible: boolean;
  currentEmail: string;
  registeredPhoneDigits: string;
  onDismiss: () => void;
  onRequestAddPhone?: () => void;
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

function maskPhoneLast4(phoneDigits: string): string {
  const d = onlyDigits(phoneDigits);
  if (d.length < 4) {
    return '••••';
  }
  return `••••${d.slice(-4)}`;
}

function normalizeEmailDraft(value: string): string {
  return value.trim().toLowerCase();
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
    infoBanner: {
      marginBottom: 12,
      padding: 12,
      borderRadius: 10,
      backgroundColor: scheme === 'dark' ? '#1e3a5f' : '#eff6ff',
      borderWidth: 1,
      borderColor: scheme === 'dark' ? '#1d4ed8' : '#bfdbfe',
    },
    infoText: { fontSize: 14, color: colors.text, lineHeight: 20 },
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
    secondaryBtn: {
      marginTop: 10,
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtnLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
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
  });
}

export function ChangeEmailModal({
  visible,
  currentEmail,
  registeredPhoneDigits,
  onDismiss,
  onRequestAddPhone,
}: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { applySessionFromProfileUpdate, refreshProfileRole } = useAuth();
  const { props: statusAlertProps, presentSuccess } = useStatusAlert();

  const hasRegisteredPhone = onlyDigits(registeredPhoneDigits).length >= 10;

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('email');
  const [emailRaw, setEmailRaw] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
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
    setStep('email');
    setEmailRaw('');
    setPendingEmail('');
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

  const mapEmailError = useCallback(
    (err: unknown): string => {
      if (err instanceof UpdateEmailError) {
        if (err.needsRegisteredPhone) {
          return t('settings.profile.changeEmail.errors.phoneRequired');
        }
        if (err.isDuplicateEmail) {
          return (
            err.message.trim() ||
            t('settings.profile.changeEmail.errors.duplicateEmail')
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

  const showEmailSuccess = useCallback(
    (apiMessage: string) => {
      presentSuccess({
        title: t('settings.profile.changeEmail.successTitle'),
        message: apiMessage.trim() || t('settings.profile.changeEmail.successMessage'),
        showMessage: true,
        buttonText: t('settings.profile.successButton'),
        dismissIconA11y: t('settings.profile.successDismissA11y'),
        onAfterDismiss: onDismiss,
      });
    },
    [onDismiss, presentSuccess, t],
  );

  const validateNewEmail = useCallback((): string | null => {
    const normalized = normalizeEmailDraft(emailRaw);
    if (!isValidEmail(normalized)) {
      return t('settings.profile.changeEmail.errors.invalidEmail');
    }
    if (normalized === normalizeEmailDraft(currentEmail)) {
      return t('settings.profile.changeEmail.errors.sameAsCurrent');
    }
    return null;
  }, [currentEmail, emailRaw, t]);

  const handleRequestOtp = useCallback(async () => {
    if (!hasRegisteredPhone) {
      return;
    }
    const validationErr = validateNewEmail();
    if (validationErr) {
      showInlineError(validationErr);
      return;
    }
    const normalized = normalizeEmailDraft(emailRaw);
    setFormError(null);
    setRequestLoading(true);
    try {
      await requestUpdateEmailOtp(normalized);
      setPendingEmail(normalized);
      setEmailRaw(normalized);
      setDigits(Array(OTP_LENGTH).fill(''));
      setStep('otp');
      startCooldownTimer();
    } catch (err) {
      if (err instanceof UpdateEmailError && err.isRateLimited) {
        startCooldownTimer();
      }
      showInlineError(mapEmailError(err));
    } finally {
      setRequestLoading(false);
    }
  }, [
    emailRaw,
    hasRegisteredPhone,
    mapEmailError,
    showInlineError,
    startCooldownTimer,
    validateNewEmail,
  ]);

  const handleResendOtp = useCallback(async () => {
    if (secondsLeft > 0 || resendLoading || !pendingEmail) {
      return;
    }
    setResendLoading(true);
    try {
      await requestUpdateEmailOtp(pendingEmail);
      setDigits(Array(OTP_LENGTH).fill(''));
      startCooldownTimer();
    } catch (err) {
      if (err instanceof UpdateEmailError && err.isRateLimited) {
        startCooldownTimer();
      }
      showInlineError(mapEmailError(err));
    } finally {
      setResendLoading(false);
    }
  }, [mapEmailError, pendingEmail, resendLoading, secondsLeft, showInlineError, startCooldownTimer]);

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
    if (otp.length !== OTP_LENGTH || verifyLoading || !pendingEmail) {
      return;
    }
    setVerifyLoading(true);
    try {
      const { message, email } = await verifyUpdateEmailOtp(pendingEmail, otp);
      await applySessionFromProfileUpdate({ email });
      try {
        await refreshProfileRole({ silent: true });
      } catch {
        /* profile saved */
      }
      showEmailSuccess(message);
    } catch (err) {
      showInlineError(mapEmailError(err));
    } finally {
      setVerifyLoading(false);
    }
  }, [
    applySessionFromProfileUpdate,
    digits,
    mapEmailError,
    pendingEmail,
    refreshProfileRole,
    showInlineError,
    showEmailSuccess,
    verifyLoading,
  ]);

  const goBackToEmail = useCallback(() => {
    setStep('email');
    setDigits(Array(OTP_LENGTH).fill(''));
    setFormError(null);
    setEmailRaw(pendingEmail || emailRaw);
  }, [emailRaw, pendingEmail]);

  const handleAddPhone = useCallback(() => {
    onDismiss();
    onRequestAddPhone?.();
  }, [onDismiss, onRequestAddPhone]);

  const codeComplete = digits.every(d => d.length === 1);
  const resendBlocked = secondsLeft > 0 || resendLoading;
  const maskedPhone = maskPhoneLast4(registeredPhoneDigits);
  const currentEmailDisplay = currentEmail.trim();

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
              {step === 'otp' && hasRegisteredPhone ? (
                <Pressable
                  onPress={goBackToEmail}
                  style={({ pressed }) => [styles.headerBack, pressed && styles.headerBackPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.profile.changeEmail.backToEmail')}>
                  <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                </Pressable>
              ) : (
                <View style={styles.headerBack} />
              )}
              <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
                {!hasRegisteredPhone
                  ? t('settings.profile.changeEmail.title')
                  : step === 'email'
                    ? t('settings.profile.changeEmail.title')
                    : t('settings.profile.changeEmail.otpTitle')}
              </Text>
              <Pressable
                onPress={onDismiss}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.headerBackPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('settings.profile.changeEmail.cancel')}>
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
              {!hasRegisteredPhone ? (
                <>
                  <View style={styles.infoBanner}>
                    <Text style={styles.infoText}>
                      {t('settings.profile.changeEmail.noPhoneMessage')}
                    </Text>
                  </View>
                  {onRequestAddPhone ? (
                    <Pressable
                      onPress={handleAddPhone}
                      style={({ pressed }) => [
                        styles.primaryBtn,
                        pressed && styles.primaryBtnPressed,
                      ]}
                      accessibilityRole="button">
                      <Text style={styles.primaryBtnLabel}>
                        {t('settings.profile.changeEmail.addPhoneAction')}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={onDismiss}
                    style={styles.secondaryBtn}
                    accessibilityRole="button">
                    <Text style={styles.secondaryBtnLabel}>
                      {t('settings.profile.changeEmail.cancel')}
                    </Text>
                  </Pressable>
                </>
              ) : step === 'email' ? (
                <>
                  <Text style={styles.subtitle}>
                    {t('settings.profile.changeEmail.emailSubtitle')}
                  </Text>
                  {currentEmailDisplay ? (
                    <View style={styles.currentRow}>
                      <MaterialCommunityIcons
                        name="email-outline"
                        size={20}
                        color={colors.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.currentLabel}>
                          {t('settings.profile.changeEmail.currentLabel')}
                        </Text>
                        <Text style={styles.currentValue} numberOfLines={2}>
                          {currentEmailDisplay}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  <Text style={styles.label}>{t('settings.profile.changeEmail.newEmailLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    value={emailRaw}
                    onChangeText={v => {
                      setFormError(null);
                      setEmailRaw(v);
                    }}
                    placeholder={t('settings.profile.emailPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    autoFocus={visible}
                  />
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
                        ? t('settings.profile.changeEmail.sending')
                        : t('settings.profile.changeEmail.continue')}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.subtitle}>
                    {t('settings.profile.changeEmail.otpSubtitle')}{' '}
                    <Text style={styles.subtitleAccent}>{maskedPhone}</Text>
                  </Text>
                  <Text style={[styles.label, { marginBottom: 12 }]}>
                    {t('settings.profile.changeEmail.otpLabel', { email: pendingEmail })}
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
                        ? t('settings.profile.changeEmail.verifying')
                        : t('settings.profile.changeEmail.verify')}
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
                          ? t('settings.profile.changeEmail.resendIn', { seconds: secondsLeft })
                          : t('settings.profile.changeEmail.resend')}
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

    <StatusAlert {...statusAlertProps} />
    </>
  );
}

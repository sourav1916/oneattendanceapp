import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import type { StoredAuthSession } from '../../storage/authStorage';

import { requestLoginOtp } from '../../api/requestLoginOtp';
import { verifyLoginOtp } from '../../api/verifyLoginOtp';
import type { AuthStackParamList } from '../../navigation/types';
import { readApiError } from '../../utils/readApiError';

import { useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';

import { ensureLocationForVerify } from './optionalLocationCoords';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 30;

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmailOtp'>;

const CELL_SIZE = Platform.OS === 'ios' ? 48 : 46;

function buildVerifyStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 32,
    },
    backLink: {
      alignSelf: 'flex-start',
      marginBottom: 20,
      paddingVertical: 4,
    },
    backPressed: {
      opacity: 0.7,
    },
    backLinkText: {
      fontSize: 15,
      color: colors.primary,
      fontWeight: '600',
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textMuted,
      marginBottom: 28,
      lineHeight: 22,
    },
    subtitleAccent: {
      color: colors.text,
      fontWeight: '600',
    },
    subtitleEmphasis: {
      fontWeight: '600',
      color: colors.textMuted,
    },
    otpRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 24,
    },
    otpCell: {
      flex: 1,
      height: CELL_SIZE,
      maxWidth: 52,
      textAlign: 'center',
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 0,
      paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    },
    primaryBtn: {
      marginTop: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryBtnPressed: {
      backgroundColor: colors.primaryPressed,
    },
    primaryBtnDisabled: {
      opacity: 0.55,
    },
    primaryBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    verifyError: {
      marginTop: 10,
      fontSize: 14,
      color: colors.danger,
      textAlign: 'center',
    },
    resendOtpBtn: {
      marginTop: 16,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 50,
      justifyContent: 'center',
    },
    resendOtpBtnPressed: {
      backgroundColor: colors.secondaryButton,
    },
    resendOtpBtnDisabled: {
      opacity: 0.75,
    },
    resendOtpText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    resendOtpTextDisabled: {
      color: colors.textMuted,
    },
    resendError: {
      marginTop: 10,
      fontSize: 14,
      color: colors.danger,
      textAlign: 'center',
    },
    goBackWrap: {
      marginTop: 16,
      alignSelf: 'center',
      paddingVertical: 8,
    },
    goBackText: {
      fontSize: 15,
      color: colors.textMuted,
    },
    goBackAccent: {
      color: colors.primary,
      fontWeight: '600',
    },
  });
}

function parseVerifyLoginResponse(
  body: unknown,
  fallbackEmail: string,
): StoredAuthSession | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const o = body as { token?: unknown; tooken?: unknown; user?: unknown };
  const rawToken =
    typeof o.token === 'string' && o.token.trim()
      ? o.token.trim()
      : typeof o.tooken === 'string' && o.tooken.trim()
        ? o.tooken.trim()
        : null;
  if (!rawToken) {
    return null;
  }
  let userEmail = fallbackEmail.trim();
  let userName = '';
  if (o.user && typeof o.user === 'object') {
    const u = o.user as { email?: unknown; name?: unknown };
    if (typeof u.email === 'string' && u.email.trim()) {
      userEmail = u.email.trim();
    }
    if (typeof u.name === 'string') {
      userName = u.name;
    }
  }
  return {
    token: rawToken,
    email: userEmail,
    name: userName,
  };
}

export function VerifyEmailOtpScreen({ navigation, route }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => buildVerifyStyles(colors), [colors]);
  const { signIn } = useAuth();
  const { email, password } = route.params;
  const [digits, setDigits] = useState<string[]>(() =>
    Array(OTP_LENGTH).fill(''),
  );
  const inputsRef = useRef<Array<TextInput | null>>([]);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SEC);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    startCooldownTimer();
    return clearCooldownTimer;
  }, [startCooldownTimer, clearCooldownTimer]);

  const setDigitAt = useCallback((index: number, value: string) => {
    setDigits(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  /** Defer focus so state/ref updates settle (needed for OTP back navigation). */
  const focusInput = useCallback((index: number) => {
    setTimeout(() => {
      inputsRef.current[index]?.focus();
    }, 0);
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
        const lastIndex = Math.min(index + chars.length, OTP_LENGTH - 1);
        focusInput(lastIndex);
        return;
      }

      // Backspace/delete: numeric pad often skips onKeyPress; handle here.
      if (numeric.length === 0) {
        const hadDigitHere = digits[index] !== '';
        setDigitAt(index, '');
        if (hadDigitHere && index > 0) {
          focusInput(index - 1);
        }
        return;
      }

      const digit = numeric.slice(-1);
      setDigitAt(index, digit);
      if (digit && index < OTP_LENGTH - 1) {
        focusInput(index + 1);
      }
    },
    [digits, focusInput, setDigitAt],
  );

  const handleOtpKeyPress = useCallback(
    (key: string, index: number) => {
      if (key !== 'Backspace' || index <= 0) {
        return;
      }
      if (digits[index] === '') {
        focusInput(index - 1);
      }
    },
    [digits, focusInput],
  );

  const handleResendOtp = async () => {
    if (secondsLeft > 0 || resendLoading) {
      return;
    }
    setResendError(null);
    setResendLoading(true);
    try {
      const response = await requestLoginOtp(email.trim(), password);
      if (response.status === 200) {
        setDigits(Array(OTP_LENGTH).fill(''));
        startCooldownTimer();
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        console.log(JSON.stringify(error.response.data));
      } else {
        console.log(error);
      }
      setResendError(readApiError(error));
    } finally {
      setResendLoading(false);
    }
  };

  const handleVerify = async () => {
    const otp = digits.join('');
    if (otp.length !== OTP_LENGTH || verifySubmitting) {
      return;
    }
    setVerifyError(null);
    setVerifySubmitting(true);
    try {
      const location = await ensureLocationForVerify();
      if (!location.ok) {
        const openAppSettings = () => {
          Linking.openSettings().catch(() => {
            /* noop */
          });
        };
        if (location.kind === 'permission') {
          Alert.alert(
            'Location required',
            'Sign-in verification needs your location. Open Settings, allow Location for One Attendance, then return and tap Verify.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: openAppSettings },
            ],
          );
        } else {
          Alert.alert(
            "Can't read location",
            'Make sure Location services are on and try again. You can open Settings to enable access for this app.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: openAppSettings },
            ],
          );
        }
        return;
      }

      const response = await verifyLoginOtp({
        email: email.trim(),
        otp,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      console.log(JSON.stringify(response.data));
      if (response.status >= 200 && response.status < 300) {
        const session = parseVerifyLoginResponse(response.data, email);
        if (!session) {
          setVerifyError('Sign-in incomplete: missing token in response.');
          return;
        }
        // Persists token and loads GET /users/profile-role (Bearer) for companies / role context.
        await signIn(session);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        console.log(JSON.stringify(error.response.data));
      } else {
        console.log(error);
      }
      setVerifyError(readApiError(error));
    } finally {
      setVerifySubmitting(false);
    }
  };

  const codeComplete = digits.every(d => d.length === 1);
  const resendBlocked = secondsLeft > 0 || resendLoading;
  const verifyDisabled = !codeComplete || verifySubmitting;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [
              styles.backLink,
              pressed && styles.backPressed,
            ]}>
            <Text style={styles.backLinkText}>← Sign in</Text>
          </Pressable>

          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{' '}
            <Text style={styles.subtitleAccent}>{email}</Text>. Enter it below
            to continue.{' '}
            <Text style={styles.subtitleEmphasis}>
              Location access is required when you verify.
            </Text>
          </Text>

          <View style={styles.otpRow} accessibilityRole="none">
            {digits.map((d, index) => (
              <TextInput
                key={index}
                ref={el => {
                  inputsRef.current[index] = el;
                }}
                value={d}
                onChangeText={text => handleOtpChange(text, index)}
                onKeyPress={({ nativeEvent }) =>
                  handleOtpKeyPress(nativeEvent.key, index)
                }
                keyboardType="number-pad"
                inputMode="numeric"
                selectTextOnFocus
                editable
                caretHidden={Platform.OS === 'android'}
                style={styles.otpCell}
                placeholder="·"
                placeholderTextColor={colors.textMuted}
              />
            ))}
          </View>

          <Pressable
            disabled={verifyDisabled}
            style={({ pressed }) => [
              styles.primaryBtn,
              verifyDisabled && styles.primaryBtnDisabled,
              pressed && !verifyDisabled && styles.primaryBtnPressed,
            ]}
            onPress={handleVerify}>
            {verifySubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Verify</Text>
            )}
          </Pressable>

          {verifyError ? (
            <Text style={styles.verifyError} accessibilityLiveRegion="polite">
              {verifyError}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              resendBlocked
                ? secondsLeft > 0
                  ? `Resend code in ${secondsLeft} seconds`
                  : 'Sending code'
                : 'Resend OTP'
            }
            disabled={resendBlocked}
            style={({ pressed }) => [
              styles.resendOtpBtn,
              resendBlocked && styles.resendOtpBtnDisabled,
              pressed && !resendBlocked && styles.resendOtpBtnPressed,
            ]}
            onPress={handleResendOtp}>
            {resendLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.resendOtpText,
                  resendBlocked && styles.resendOtpTextDisabled,
                ]}>
                {secondsLeft > 0
                  ? `Resend OTP in ${secondsLeft}s`
                  : 'Resend OTP'}
              </Text>
            )}
          </Pressable>

          {resendError ? (
            <Text style={styles.resendError} accessibilityLiveRegion="polite">
              {resendError}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Wrong email, go back to sign in"
            style={styles.goBackWrap}
            onPress={() => navigation.navigate('Login')}>
            <Text style={styles.goBackText}>
              Wrong email? <Text style={styles.goBackAccent}>Go back</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

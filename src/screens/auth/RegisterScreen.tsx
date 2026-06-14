import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildRequestSignupOtpParams, requestSignupOtp } from '@src/api/requestSignupOtp';
import { verifySignupOtp } from '@src/api/verifySignupOtp';
import {
  SvgEyeOffOutline,
  SvgEyeOutline,
} from '@src/components/icons/PasswordVisibilityIcon';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AuthStackParamList } from '@src/navigation/types';
import { AuthScreenChrome } from '@src/components/auth/AuthScreenChrome';
import { buildAuthScreenStyles } from '@src/theme/authScreenVisuals';
import { tryOptionalLocationCoords } from '@src/utils/optionalLocationCoords';
import type { SignupType } from '@src/types/signupAuth';
import { parseAuthSessionResponse } from '@src/utils/parseAuthSessionResponse';
import {
  analyzePasswordPolicy,
  isPasswordPolicySatisfied,
  type PasswordPolicyAnalysis,
} from '@src/utils/passwordPolicy';
import { readApiError } from '@src/utils/readApiError';
import {
  getSignupPlatform,
  normalizeSignupPhoneDigits,
  readApiSuccessMessage,
  validateSignupRequestStep,
  validateSignupVerifyStep,
} from '@src/utils/signupValidation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

type RegisterStep = 'contact' | 'verify';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 30;

const PASSWORD_RULE_ROWS: { key: keyof Omit<PasswordPolicyAnalysis, 'noEdgeSpaces'>; label: string }[] =
  [
    { key: 'minLength', label: '8+ characters' },
    { key: 'upper', label: 'Uppercase letter' },
    { key: 'lower', label: 'Lowercase letter' },
    { key: 'digit', label: 'Number' },
    { key: 'special', label: 'Special character' },
  ];

export function RegisterScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const { styles } = useMemo(
    () => buildAuthScreenStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const { signIn } = useAuth();
  const { props: confirmProps, present } = useConfirmAlert();

  const [step, setStep] = useState<RegisterStep>('contact');
  const [signupType, setSignupType] = useState<SignupType>('email');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [confirmedPhone, setConfirmedPhone] = useState('');

  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(''));
  const otpInputsRef = useRef<Array<TextInput | null>>([]);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const [sendOtpLoading, setSendOtpLoading] = useState(false);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Enter the 6-digit code we sent you.');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SEC);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPhoneSignup = signupType === 'phone';
  const phoneDigits = normalizeSignupPhoneDigits(phoneNumber);
  const activeEmail = step === 'verify' ? confirmedEmail : email.trim().toLowerCase();
  const activePhone =
    step === 'verify' ? confirmedPhone : normalizeSignupPhoneDigits(phoneNumber);

  const presentError = useCallback(
    (title: string, message: string) => {
      present({
        title,
        message: message.trim() || 'Please try again.',
        buttons: [{ text: 'OK', variant: 'primary' }],
      });
    },
    [present],
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

  useEffect(() => {
    if (step !== 'verify') {
      return;
    }
    startCooldownTimer();
    return clearCooldownTimer;
  }, [step, startCooldownTimer, clearCooldownTimer]);

  const resetToContactStep = useCallback(() => {
    setStep('contact');
    setDigits(Array(OTP_LENGTH).fill(''));
    clearCooldownTimer();
  }, [clearCooldownTimer]);

  const destinationLabel = isPhoneSignup
    ? `phone ending ${activePhone.slice(-4) || '····'}`
    : activeEmail || 'your email';

  const handleSendOtp = async () => {
    const validationError = validateSignupRequestStep({
      signupType,
      email,
      phone: phoneDigits,
    });

    if (validationError) {
      presentError('Check your details', validationError);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizeSignupPhoneDigits(phoneNumber);

    setSendOtpLoading(true);
    try {
      const otpParams = buildRequestSignupOtpParams(signupType, email, normalizedPhone);
      const response = await requestSignupOtp(otpParams);

      if (response.status >= 200 && response.status < 300) {
        setConfirmedEmail(signupType === 'email' ? normalizedEmail : '');
        setConfirmedPhone(signupType === 'phone' ? normalizedPhone : '');
        setDigits(Array(OTP_LENGTH).fill(''));
        setStatusMessage(
          readApiSuccessMessage(response.data, 'We sent a verification code to your contact.'),
        );
        setStep('verify');
      }
    } catch (error) {
      const message = readApiError(error);
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        present({
          title: 'Account already exists',
          message,
          buttons: [
            { key: 'dismiss', text: 'OK', variant: 'secondary' },
            {
              key: 'login',
              text: 'Log in',
              variant: 'primary',
              onPress: () => navigation.navigate('Login'),
            },
          ],
        });
      } else {
        presentError('Could not send code', message);
      }
    } finally {
      setSendOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (secondsLeft > 0 || resendLoading) {
      return;
    }
    setResendLoading(true);
    try {
      const otpParams = isPhoneSignup
        ? buildRequestSignupOtpParams('phone', '', activePhone)
        : buildRequestSignupOtpParams('email', activeEmail, '');
      const response = await requestSignupOtp(otpParams);
      if (response.status >= 200 && response.status < 300) {
        setDigits(Array(OTP_LENGTH).fill(''));
        setStatusMessage(
          readApiSuccessMessage(response.data, 'A new verification code has been sent.'),
        );
        startCooldownTimer();
      }
    } catch (error) {
      presentError('Could not resend code', readApiError(error));
    } finally {
      setResendLoading(false);
    }
  };

  const setDigitAt = useCallback((index: number, value: string) => {
    setDigits(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const focusOtpInput = useCallback((index: number) => {
    setTimeout(() => {
      otpInputsRef.current[index]?.focus();
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
        focusOtpInput(Math.min(index + chars.length, OTP_LENGTH - 1));
        return;
      }

      if (numeric.length === 0) {
        const hadDigitHere = digits[index] !== '';
        setDigitAt(index, '');
        if (hadDigitHere && index > 0) {
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

  const handleCreateAccount = async () => {
    const otp = digits.join('');
    if (verifySubmitting) {
      return;
    }

    const validationError = validateSignupVerifyStep({
      signupType,
      email: activeEmail,
      phone: activePhone,
      otp,
      name,
      password,
      confirmPassword,
    });

    if (validationError) {
      presentError('Check your details', validationError);
      return;
    }

    setVerifySubmitting(true);
    try {
      const coords = await tryOptionalLocationCoords();
      const verifyBase = {
        password,
        otp,
        name: name.trim(),
        platform: getSignupPlatform(),
        ...(coords
          ? { latitude: coords.latitude, longitude: coords.longitude }
          : {}),
      };

      const response = await verifySignupOtp(
        isPhoneSignup
          ? { signupType: 'phone', phone: activePhone, ...verifyBase }
          : { signupType: 'email', email: activeEmail.trim(), ...verifyBase },
      );

      if (response.status >= 200 && response.status < 300) {
        const sessionFallback = isPhoneSignup ? '' : activeEmail.trim();
        const session = parseAuthSessionResponse(response.data, sessionFallback);
        if (!session) {
          presentError(
            'Sign up failed',
            'Sign-up incomplete: missing token in response.',
          );
          return;
        }
        await signIn(session);
      }
    } catch (error) {
      presentError('Sign up failed', readApiError(error));
    } finally {
      setVerifySubmitting(false);
    }
  };

  const codeComplete = digits.every(d => d.length === 1);
  const resendBlocked = secondsLeft > 0 || resendLoading;

  const passwordAnalysis = useMemo(() => analyzePasswordPolicy(password), [password]);

  const passwordsMatch = useMemo(() => {
    if (!password || !confirmPassword) {
      return false;
    }
    return password === confirmPassword;
  }, [password, confirmPassword]);

  const isVerifyFormValid = useMemo(() => {
    if (!codeComplete) {
      return false;
    }
    if (!name.trim()) {
      return false;
    }
    if (!isPasswordPolicySatisfied(passwordAnalysis)) {
      return false;
    }
    if (!confirmPassword) {
      return false;
    }
    return passwordsMatch;
  }, [codeComplete, name, passwordAnalysis, confirmPassword, passwordsMatch]);

  const ruleStatusStyle = useCallback(
    (ok: boolean, showFailure: boolean) => {
      if (ok) {
        return styles.ruleMet;
      }
      if (showFailure) {
        return styles.ruleFail;
      }
      return styles.ruleNeutral;
    },
    [styles.ruleMet, styles.ruleFail, styles.ruleNeutral],
  );

  const verifyDisabled = verifySubmitting || !isVerifyFormValid;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AuthScreenChrome>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(16, insets.bottom) },
          ]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>Join One Attendance</Text>
            <Text style={[styles.title, styles.titleLeft]}>
              {step === 'contact' ? 'Create account' : 'Complete sign up'}
            </Text>
            <Text style={[styles.subtitle, styles.subtitleLeft]}>
              {step === 'contact' ? (
                'Choose email or phone — we will send a one-time code to verify your contact.'
              ) : (
                <>
                  Enter the code sent to{' '}
                  <Text style={styles.subtitleAccent}>{destinationLabel}</Text>
                </>
              )}
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, step === 'contact' && styles.stepDotActive]} />
              <View style={[styles.stepDot, step === 'verify' && styles.stepDotActive]} />
              <Text style={styles.stepLabel}>
                {step === 'contact' ? 'Step 1 of 2' : 'Step 2 of 2'}
              </Text>
            </View>

            {step === 'contact' ? (
              <>
                <View style={styles.segmentRow} accessibilityRole="tablist">
                  {(['email', 'phone'] as const).map(type => {
                    const active = signupType === type;
                    return (
                      <Pressable
                        key={type}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Sign up with ${type}`}
                        onPress={() => {
                          setSignupType(type);
                          if (type === 'email') {
                            setPhoneNumber('');
                          } else {
                            setEmail('');
                          }
                        }}
                        style={({ pressed }) => [
                          styles.segmentChip,
                          active && styles.segmentChipActive,
                          pressed && styles.segmentChipPressed,
                        ]}>
                        <Text
                          style={[
                            styles.segmentChipText,
                            active && styles.segmentChipTextActive,
                          ]}>
                          {type === 'email' ? 'Email' : 'Phone'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {signupType === 'email' ? (
                  <View style={styles.field}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@company.com"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      style={styles.input}
                    />
                  </View>
                ) : (
                  <View style={styles.field}>
                    <Text style={styles.label}>Phone number</Text>
                    <TextInput
                      value={phoneNumber}
                      onChangeText={text => setPhoneNumber(text.replace(/\D/g, ''))}
                      placeholder="9876543210"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="tel"
                      maxLength={15}
                      style={styles.input}
                    />
                  </View>
                )}

                <Pressable
                  disabled={sendOtpLoading}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    sendOtpLoading && styles.primaryBtnDisabled,
                    pressed && !sendOtpLoading && styles.primaryBtnPressed,
                  ]}
                  onPress={() => void handleSendOtp()}>
                  {sendOtpLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Send OTP</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change contact details"
                  onPress={resetToContactStep}
                  style={({ pressed }) => [styles.backLink, pressed && styles.backPressed]}>
                  <Text style={styles.backLinkText}>← Change contact</Text>
                </Pressable>

                <View style={styles.infoCard}>
                  <View style={styles.infoBadge}>
                    <Text style={styles.infoBadgeText}>✓</Text>
                  </View>
                  <View style={styles.infoBody}>
                    <Text style={styles.infoTitle}>Verification code sent</Text>
                    <Text style={styles.infoMessage}>{statusMessage}</Text>
                  </View>
                </View>

                <Text style={styles.label}>Verification code</Text>
                <View style={styles.otpRow} accessibilityRole="none">
                  {digits.map((d, index) => (
                    <TextInput
                      key={index}
                      ref={el => {
                        otpInputsRef.current[index] = el;
                      }}
                      value={d}
                      onChangeText={text => handleOtpChange(text, index)}
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

                <View style={styles.field}>
                  <Text style={styles.label}>Full name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="John Doe"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    autoComplete="name"
                    style={styles.input}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordField}>
                    <TextInput
                      value={password}
                      onChangeText={text => {
                        setPassword(text);
                      }}
                      placeholder="Create a strong password"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!passwordVisible}
                      autoCapitalize="none"
                      autoComplete="password-new"
                      textContentType="newPassword"
                      style={styles.passwordInput}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                      onPress={() => setPasswordVisible(v => !v)}
                      style={({ pressed }) => [
                        styles.passwordToggle,
                        pressed && styles.passwordTogglePressed,
                      ]}>
                      {passwordVisible ? (
                        <SvgEyeOffOutline size={22} color={colors.textMuted} />
                      ) : (
                        <SvgEyeOutline size={22} color={colors.textMuted} />
                      )}
                    </Pressable>
                  </View>
                  <View style={styles.requirementsBlock}>
                    <Text style={styles.requirementsTitle}>Password must include</Text>
                    {PASSWORD_RULE_ROWS.map(({ key, label }) => {
                      const ok = passwordAnalysis[key];
                      const showFailure = password.length > 0 && !ok;
                      const status = ruleStatusStyle(ok, showFailure);
                      return (
                        <View key={key} style={styles.ruleRow}>
                          <Text style={[styles.ruleBullet, status]}>{ok ? '✓' : '○'}</Text>
                          <Text style={[styles.ruleLabel, status]}>{label}</Text>
                        </View>
                      );
                    })}
                    {password.length > 0 && !passwordAnalysis.noEdgeSpaces ? (
                      <Text style={styles.confirmHint}>
                        Remove leading or trailing spaces.
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Confirm password</Text>
                  <View style={styles.passwordField}>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={text => {
                        setConfirmPassword(text);
                      }}
                      placeholder="Repeat password"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!confirmPasswordVisible}
                      autoCapitalize="none"
                      autoComplete="password-new"
                      textContentType="newPassword"
                      style={styles.passwordInput}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        confirmPasswordVisible ? 'Hide password' : 'Show password'
                      }
                      onPress={() => setConfirmPasswordVisible(v => !v)}
                      style={({ pressed }) => [
                        styles.passwordToggle,
                        pressed && styles.passwordTogglePressed,
                      ]}>
                      {confirmPasswordVisible ? (
                        <SvgEyeOffOutline size={22} color={colors.textMuted} />
                      ) : (
                        <SvgEyeOutline size={22} color={colors.textMuted} />
                      )}
                    </Pressable>
                  </View>
                  {confirmPassword.length > 0 && !passwordsMatch ? (
                    <Text style={styles.confirmHint}>Passwords do not match.</Text>
                  ) : null}
                </View>

                <Pressable
                  disabled={verifyDisabled}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    verifyDisabled && styles.primaryBtnDisabled,
                    pressed && !verifyDisabled && styles.primaryBtnPressed,
                  ]}
                  onPress={() => void handleCreateAccount()}>
                  {verifySubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Create account</Text>
                  )}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  disabled={resendBlocked}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    resendBlocked && styles.secondaryBtnDisabled,
                    pressed && !resendBlocked && styles.secondaryBtnPressed,
                  ]}
                  onPress={() => void handleResendOtp()}>
                  {resendLoading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text
                      style={[
                        styles.secondaryBtnText,
                        resendBlocked && styles.secondaryBtnTextDisabled,
                      ]}>
                      {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
                    </Text>
                  )}
                </Pressable>

              </>
            )}
          </View>

          <Pressable
            style={styles.linkWrap}
            onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkMuted}>
              Already have an account?{' '}
              <Text style={styles.linkAccent}>Log in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </AuthScreenChrome>
      <ConfirmAlert {...confirmProps} />
    </SafeAreaView>
  );
}

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import axios from 'axios';
import { useCallback, useMemo, useState } from 'react';

import { continueWithGoogle } from '@src/api/continueWithGoogle';
import { continueWithTruecaller } from '@src/api/continueWithTruecaller';
import { requestLoginOtp } from '@src/api/requestLoginOtp';
import type { LoginType } from '@src/types/loginAuth';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { CountryCodePicker } from '@src/components/modals/CountryCodePicker';
import {
  SvgEyeOffOutline,
  SvgEyeOutline,
} from '@src/components/icons/PasswordVisibilityIcon';
import {
  SocialLoginIcon,
  type SocialBrand,
} from '@src/components/icons/SocialLoginIcon';
import {
  DEFAULT_LOGIN_COUNTRY,
  findLoginCountryByDialCode,
  type LoginCountry,
} from '@src/utils/loginCountries';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { AuthScreenChrome } from '@src/screens/auth/AuthScreenChrome';
import { buildAuthScreenStyles } from '@src/screens/auth/authScreenVisuals';
import { useLoginTruecaller } from '@src/hooks/useLoginTruecaller';
import type { TruecallerAndroidResponse } from '@ajitpatel28/react-native-truecaller';
import type { AuthStackParamList } from '@src/navigation/types';
import { tryOptionalLocationCoords } from '@src/screens/auth/optionalLocationCoords';
import { getAuthContinuePlatform } from '@src/utils/authPlatform';
import {
  GoogleSignInCancelledError,
  mapGoogleSignInError,
  requestGoogleIdToken,
} from '@src/utils/googleSignIn';
import {
  formatPhoneForApi,
  isValidEmail,
  isValidNationalMobile,
} from '@src/utils/loginIdentifier';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { parseAuthSessionResponse } from '@src/utils/parseAuthSessionResponse';
import { readApiError } from '@src/utils/readApiError';
import { isTruecallerUserDismissal } from '@src/utils/truecallerErrors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const SOCIAL_PROVIDERS: readonly { id: SocialBrand; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'twitter', label: 'Twitter' },
  { id: 'microsoft', label: 'Microsoft' },
];

export function LoginScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { styles } = useMemo(
    () => buildAuthScreenStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const isDarkScheme = resolvedScheme === 'dark';
  const { signIn } = useAuth();
  const { props: confirmProps, present } = useConfirmAlert();
  const [loginType, setLoginType] = useState<LoginType>('phone');
  const [email, setEmail] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<LoginCountry>(DEFAULT_LOGIN_COUNTRY);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  /** false = bullets (default); toggle eye to show plaintext. */
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [truecallerBusy, setTruecallerBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const authBusy = submitting || truecallerBusy || googleBusy;

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

  const handleTruecallerProfile = useCallback(
    (profile: { email: string | null; phoneNumber: string }) => {
      const phone = profile.phoneNumber?.replace(/\D/g, '') ?? '';
      if (phone.length >= 10) {
        setLoginType('phone');
        const national = phone.length > 10 ? phone.slice(-10) : phone;
        setPhoneNumber(national);
        if (phone.startsWith('91') && phone.length > 10) {
          const india = findLoginCountryByDialCode('+91');
          if (india) {
            setSelectedCountry(india);
          }
        }
      } else if (profile.email?.trim()) {
        setLoginType('email');
        setEmail(profile.email.trim());
      }
    },
    [],
  );

  const handleTruecallerError = useCallback(
    (message: string) => {
      if (isTruecallerUserDismissal(message)) {
        return;
      }
      presentError('Truecaller sign-in failed', message);
    },
    [presentError],
  );

  const handleTruecallerOAuthSuccess = useCallback(
    async (data: TruecallerAndroidResponse) => {
      const code = data.authorizationCode?.trim();
      const codeVerifier = data.codeVerifier?.trim();
      if (!code || !codeVerifier) {
        presentError(
          'Truecaller sign-in failed',
          'Truecaller sign-in incomplete. Please try again.',
        );
        return;
      }

      setTruecallerBusy(true);
      try {
        const coords = await tryOptionalLocationCoords();
        const response = await continueWithTruecaller({
          code,
          code_verifier: codeVerifier,
          platform: getAuthContinuePlatform(),
          ...(coords
            ? { latitude: coords.latitude, longitude: coords.longitude }
            : {}),
        });

        if (response.status >= 200 && response.status < 300) {
          const session = parseAuthSessionResponse(response.data);
          if (!session) {
            presentError(
              'Sign-in failed',
              'Sign-in incomplete: missing token in response.',
            );
            return;
          }
          await signIn(session);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.data) {
          console.log(JSON.stringify(error.response.data));
        }
        presentError('Truecaller sign-in failed', readApiError(error));
      } finally {
        setTruecallerBusy(false);
      }
    },
    [presentError, signIn],
  );

  const isLoginFormFilled = useMemo(() => {
    if (!password.trim()) {
      return false;
    }
    if (loginType === 'email') {
      return email.trim().length > 0;
    }
    return phoneNumber.trim().length > 0;
  }, [loginType, email, phoneNumber, password]);

  const loginDisabled = authBusy || !isLoginFormFilled;

  const {
    openTruecallerLogin,
    isTruecallerConfigured,
    isTruecallerAvailable,
    availabilityResolved,
  } = useLoginTruecaller({
    autoOpenOnMount: true,
    onProfile: handleTruecallerProfile,
    onOAuthSuccess: handleTruecallerOAuthSuccess,
    onError: handleTruecallerError,
  });

  const showTruecallerButton =
    Platform.OS === 'android' &&
    isTruecallerConfigured &&
    (isTruecallerAvailable || !availabilityResolved);

  const handleTruecallerPress = async () => {
    setTruecallerBusy(true);
    try {
      await openTruecallerLogin();
    } finally {
      setTruecallerBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleBusy(true);
    try {
      const credential = await requestGoogleIdToken();
      const coords = await tryOptionalLocationCoords();
      const response = await continueWithGoogle({
        credential,
        platform: getAuthContinuePlatform(),
        ...(coords
          ? { latitude: coords.latitude, longitude: coords.longitude }
          : {}),
      });

      if (response.status >= 200 && response.status < 300) {
        const session = parseAuthSessionResponse(response.data);
        if (!session) {
          presentError(
            'Sign-in failed',
            'Sign-in incomplete: missing token in response.',
          );
          return;
        }
        await signIn(session);
      }
    } catch (error) {
      if (error instanceof GoogleSignInCancelledError) {
        return;
      }
      if (axios.isAxiosError(error) && error.response?.data) {
        console.log(JSON.stringify(error.response.data));
      }
      presentError(
        'Google sign-in failed',
        mapGoogleSignInError(error) || readApiError(error),
      );
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!password) {
      presentError('Check your details', 'Please enter your password.');
      return;
    }

    let identifier = '';
    const otpParams =
      loginType === 'email'
        ? (() => {
            const trimmedEmail = email.trim();
            if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
              presentError('Check your details', 'Please enter a valid email address.');
              return null;
            }
            identifier = trimmedEmail;
            return {
              loginType: 'email' as const,
              password,
              email: trimmedEmail,
            };
          })()
        : (() => {
            if (!isValidNationalMobile(phoneNumber)) {
              presentError('Check your details', 'Please enter a valid phone number.');
              return null;
            }
            const formattedPhone = formatPhoneForApi(
              selectedCountry.dialCode,
              phoneNumber,
            );
            identifier = formattedPhone;
            return {
              loginType: 'phone' as const,
              password,
              phone: formattedPhone,
            };
          })();

    if (!otpParams) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await requestLoginOtp(otpParams);
      console.log(JSON.stringify(response.data));

      if (response.status === 200) {
        navigation.navigate('VerifyEmailOtp', {
          loginType: otpParams.loginType,
          identifier,
          password,
        });
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        console.log(JSON.stringify(error.response.data));
      } else {
        console.log(error);
      }
      presentError('Couldn\'t sign in', readApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

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
            <View style={styles.logoRing}>
              <Image
                accessibilityIgnoresInvertColors
                source={require('../../assets/images/logo_512x512.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.eyebrow}>One Attendance</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue to your workspace</Text>
          </View>

          <View style={styles.formCard}>
          <View style={styles.segmentRow} accessibilityRole="tablist">
            {(['phone', 'email'] as const).map(type => {
              const active = loginType === type;
              return (
                <Pressable
                  key={type}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={type === 'email' ? 'Sign in with email' : 'Sign in with phone'}
                  onPress={() => {
                    setLoginType(type);
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

          {loginType === 'email' ? (
            <View style={styles.field}>
              <Text style={[styles.label, styles.labelStandalone]}>Email</Text>
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
              <Text style={[styles.label, styles.labelStandalone]}>Phone number</Text>
              <View style={styles.mobileRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Country code ${selectedCountry.dialCode}, ${selectedCountry.name}`}
                  onPress={() => setCountryPickerOpen(true)}
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
                  value={phoneNumber}
                  onChangeText={text => setPhoneNumber(text.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="tel"
                  maxLength={15}
                  style={[styles.input, styles.phoneNumberInput]}
                />
              </View>
            </View>
          )}

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Forgot password"
                hitSlop={8}
                onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotLink}>Forgot password?</Text>
              </Pressable>
            </View>
            <View style={styles.passwordField}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoComplete="password"
                style={styles.passwordInput}
                textContentType="password"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  passwordVisible ? 'Hide password' : 'Show password'
                }
                hitSlop={10}
                onPress={() => setPasswordVisible(prev => !prev)}
                style={({ pressed }) => [
                  styles.passwordToggle,
                  pressed && styles.passwordTogglePressed,
                ]}>
                {passwordVisible ? (
                  <SvgEyeOffOutline
                    size={22}
                    color={colors.textMuted}
                  />
                ) : (
                  <SvgEyeOutline size={22} color={colors.textMuted} />
                )}
              </Pressable>
            </View>
          </View>

          <Pressable
            disabled={loginDisabled}
            style={({ pressed }) => [
              styles.primaryBtn,
              loginDisabled && styles.primaryBtnDisabled,
              pressed && !loginDisabled && styles.primaryBtnPressed,
            ]}
            onPress={handleRequestOtp}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Log in</Text>
            )}
          </Pressable>

          {showTruecallerButton ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue with Truecaller"
              disabled={authBusy}
              style={({ pressed }) => [
                styles.truecallerBtn,
                authBusy && styles.primaryBtnDisabled,
                pressed && !authBusy && styles.truecallerBtnPressed,
              ]}
              onPress={handleTruecallerPress}>
              {truecallerBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.truecallerBtnText}>Continue with Truecaller</Text>
              )}
            </Pressable>
          ) : null}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            {SOCIAL_PROVIDERS.map(({ id: brand, label }) => {
              const providerDisabled = authBusy || brand !== 'google';
              return (
                <Pressable
                  key={brand}
                  accessibilityRole="button"
                  accessibilityLabel={`Continue with ${label}`}
                  disabled={providerDisabled}
                  style={({ pressed }) => [
                    styles.socialBtn,
                    authBusy && styles.primaryBtnDisabled,
                    pressed && !providerDisabled && styles.socialBtnPressed,
                  ]}
                  onPress={() => {
                    if (brand === 'google') {
                      void handleGoogleLogin();
                    }
                  }}>
                  {brand === 'google' && googleBusy ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <SocialLoginIcon
                      brand={brand}
                      size={28}
                      disabled={brand !== 'google'}
                      darkMode={isDarkScheme}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
          </View>

          <Pressable
            style={styles.linkWrap}
            onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkMuted}>
              New here?{' '}
              <Text style={styles.linkAccent}>Create an account</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </AuthScreenChrome>

      <ConfirmAlert {...confirmProps} />

      <CountryCodePicker
        visible={countryPickerOpen}
        title="Select country"
        cancelLabel="Cancel"
        selectedCountryCode={selectedCountry.code}
        searchPlaceholder="Search country or dial code"
        onDismiss={() => setCountryPickerOpen(false)}
        onSelectCountry={country => {
          setSelectedCountry(country);
          setCountryPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

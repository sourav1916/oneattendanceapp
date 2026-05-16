import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import axios from 'axios';
import { useMemo, useState } from 'react';

import { requestLoginOtp } from '@src/api/requestLoginOtp';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  SvgEyeOffOutline,
  SvgEyeOutline,
} from '@src/components/icons/PasswordVisibilityIcon';
import {
  SocialLoginIcon,
  type SocialBrand,
} from '@src/components/icons/SocialLoginIcon';
import type { AuthStackParamList } from '@src/navigation/types';
import { useThemeColors } from '@src/context/ThemeContext';
import type { AppThemeColors } from '@src/theme/palettes';
import { readApiError } from '@src/utils/readApiError';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const SOCIAL_PROVIDERS: readonly {
  id: SocialBrand;
  label: string;
  color: string;
}[] = [
    { id: 'google', label: 'Google', color: '#4285F4' },
    { id: 'facebook', label: 'Facebook', color: '#1877F2' },
    { id: 'twitter', label: 'Twitter', color: '#000000' },
    { id: 'microsoft', label: 'Microsoft', color: '#00A4EF' },
  ];

const LOGO_SIZE = 112;

function buildLoginStyles(colors: AppThemeColors) {
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
      paddingTop: 16,
      paddingBottom: 32,
    },
    logo: {
      width: LOGO_SIZE,
      height: LOGO_SIZE,
      alignSelf: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textMuted,
      marginBottom: 28,
      textAlign: 'center',
    },
    field: {
      marginBottom: 18,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      gap: 12,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    labelStandalone: {
      marginBottom: 8,
    },
    forgotLink: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 14 : 10,
      fontSize: 16,
      color: colors.text,
    },
    passwordField: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingLeft: 14,
      paddingRight: 4,
      minHeight: Platform.OS === 'ios' ? 50 : 46,
    },
    passwordInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? 14 : 10,
      paddingRight: 8,
      fontSize: 16,
      color: colors.text,
    },
    passwordToggle: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    passwordTogglePressed: {
      opacity: 0.6,
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
      opacity: 0.75,
    },
    errorText: {
      marginTop: 10,
      fontSize: 14,
      color: colors.danger,
      textAlign: 'center',
    },
    primaryBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 28,
      marginBottom: 20,
      gap: 12,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    dividerText: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '500',
    },
    socialRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    socialBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    socialBtnPressed: {
      opacity: 0.85,
      backgroundColor: colors.secondaryButton,
    },
    linkWrap: {
      marginTop: 28,
      alignSelf: 'center',
    },
    linkMuted: {
      fontSize: 15,
      color: colors.textMuted,
    },
    linkAccent: {
      color: colors.primary,
      fontWeight: '600',
    },
  });
}

export function LoginScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => buildLoginStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  /** false = bullets (default); toggle eye to show plaintext. */
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleRequestOtp = async () => {
    const trimmedEmail = email.trim();
    setSubmitError(null);

    if (!trimmedEmail || !password) {
      setSubmitError('Please enter email and password.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await requestLoginOtp(trimmedEmail, password);
      console.log(JSON.stringify(response.data));

      if (response.status === 200) {
        navigation.navigate('VerifyEmailOtp', {
          email: trimmedEmail,
          password,
        });
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        console.log(JSON.stringify(error.response.data));
      } else {
        console.log(error);
      }
      setSubmitError(readApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}>
          <Image
            accessibilityIgnoresInvertColors
            source={require('../../assets/images/logo_512x512.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

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
            disabled={submitting}
            style={({ pressed }) => [
              styles.primaryBtn,
              submitting && styles.primaryBtnDisabled,
              pressed && !submitting && styles.primaryBtnPressed,
            ]}
            onPress={handleRequestOtp}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Log in</Text>
            )}
          </Pressable>

          {submitError ? (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {submitError}
            </Text>
          ) : null}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or sign in with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            {SOCIAL_PROVIDERS.map(({ id: brand, label, color }) => (
              <Pressable
                key={brand}
                accessibilityRole="button"
                accessibilityLabel={`Continue with ${label}`}
                style={({ pressed }) => [
                  styles.socialBtn,
                  pressed && styles.socialBtnPressed,
                ]}
                onPress={() => {
                  // Wire OAuth for each provider later
                }}>
                <SocialLoginIcon brand={brand} size={28} color={color} />
              </Pressable>
            ))}
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
      </View>
    </SafeAreaView>
  );
}

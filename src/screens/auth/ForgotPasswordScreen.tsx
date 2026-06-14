import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { AuthStackParamList } from '@src/navigation/types';
import { AuthScreenChrome } from '@src/components/auth/AuthScreenChrome';
import { buildAuthScreenStyles } from '@src/theme/authScreenVisuals';
import type { AppThemeColors } from '@src/theme/palettes';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const RECOVERY_STEPS = [
  { key: 'email', icon: 'email-outline' as const, label: 'Your email' },
  { key: 'link', icon: 'link-variant' as const, label: 'Reset link' },
  { key: 'done', icon: 'shield-check-outline' as const, label: 'New password' },
];

function buildForgotHeaderStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
  const isDark = scheme === 'dark';
  const accent = colors.primary;
  const accentSoft = isDark ? 'rgba(96, 165, 250, 0.14)' : 'rgba(37, 99, 235, 0.1)';
  const cardBg = isDark ? 'rgba(30, 41, 59, 0.72)' : '#ffffff';
  const cardBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(226, 232, 240, 0.95)';

  return StyleSheet.create({
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      marginBottom: 16,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.55)' : 'rgba(255, 255, 255, 0.88)',
      borderWidth: 1,
      borderColor: cardBorder,
    },
    backRowPressed: {
      opacity: 0.82,
    },
    backRowText: {
      fontSize: 15,
      fontWeight: '700',
      color: accent,
    },
    headerCard: {
      borderRadius: 22,
      padding: 20,
      marginBottom: 20,
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: cardBorder,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.28 : 0.08,
          shadowRadius: 18,
        },
        android: { elevation: isDark ? 4 : 3 },
      }),
    },
    headerGlow: {
      position: 'absolute',
      top: -48,
      right: -32,
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: accentSoft,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      marginBottom: 18,
    },
    iconRing: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: accentSoft,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(96, 165, 250, 0.28)' : 'rgba(37, 99, 235, 0.16)',
    },
    headerTextBlock: {
      flex: 1,
      minWidth: 0,
      paddingTop: 2,
    },
    eyebrow: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(51, 65, 85, 0.65)' : '#eff6ff',
      marginBottom: 10,
    },
    eyebrowText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: accent,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.4,
      lineHeight: 32,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      lineHeight: 22,
    },
    stepsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    stepSegment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    stepItem: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
    },
    stepIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.55)' : '#f8fafc',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0',
    },
    stepIconWrapActive: {
      backgroundColor: accentSoft,
      borderColor: isDark ? 'rgba(96, 165, 250, 0.35)' : 'rgba(37, 99, 235, 0.22)',
    },
    stepConnector: {
      width: 10,
      height: 2,
      borderRadius: 1,
      backgroundColor: isDark ? 'rgba(148, 163, 184, 0.35)' : '#cbd5e1',
      marginTop: 17,
      marginHorizontal: 2,
    },
    stepLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 14,
    },
    stepLabelActive: {
      color: accent,
      fontWeight: '700',
    },
    infoStrip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDark ? 'rgba(148, 163, 184, 0.22)' : '#e2e8f0',
    },
    infoStripIcon: {
      marginTop: 1,
    },
    infoStripText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textMuted,
    },
  });
}

function ForgotPasswordHeader({
  headerStyles,
  accent,
}: {
  headerStyles: ReturnType<typeof buildForgotHeaderStyles>;
  accent: string;
}) {
  return (
    <View style={headerStyles.headerCard}>
      <View style={headerStyles.headerGlow} pointerEvents="none" />
      <View style={headerStyles.headerTop}>
        <View style={headerStyles.iconRing}>
          <MaterialCommunityIcons name="lock-reset" size={30} color={accent} />
        </View>
        <View style={headerStyles.headerTextBlock}>
          <View style={headerStyles.eyebrow}>
            <MaterialCommunityIcons name="lifebuoy" size={13} color={accent} />
            <Text style={headerStyles.eyebrowText}>Account recovery</Text>
          </View>
          <Text style={headerStyles.title} accessibilityRole="header">
            Forgot password
          </Text>
          <Text style={headerStyles.subtitle}>
            Enter the email tied to your account and we will send you a secure reset link.
          </Text>
        </View>
      </View>

      <View style={headerStyles.stepsRow}>
        {RECOVERY_STEPS.map((step, index) => {
          const active = index === 0;
          return (
            <View key={step.key} style={headerStyles.stepSegment}>
              {index > 0 ? <View style={headerStyles.stepConnector} /> : null}
              <View style={headerStyles.stepItem}>
                <View
                  style={[
                    headerStyles.stepIconWrap,
                    active && headerStyles.stepIconWrapActive,
                  ]}>
                  <MaterialCommunityIcons
                    name={step.icon}
                    size={18}
                    color={active ? accent : '#94a3b8'}
                  />
                </View>
                <Text
                  style={[headerStyles.stepLabel, active && headerStyles.stepLabelActive]}
                  numberOfLines={2}>
                  {step.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={headerStyles.infoStrip}>
        <MaterialCommunityIcons
          name="information-outline"
          size={18}
          color={accent}
          style={headerStyles.infoStripIcon}
        />
        <Text style={headerStyles.infoStripText}>
          The link expires after a short time. Check spam if you do not see the email within a few
          minutes.
        </Text>
      </View>
    </View>
  );
}

export function ForgotPasswordScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const { resolvedScheme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { styles: authStyles } = useMemo(
    () => buildAuthScreenStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const headerStyles = useMemo(
    () => buildForgotHeaderStyles(colors, resolvedScheme),
    [colors, resolvedScheme],
  );
  const [email, setEmail] = useState('');

  return (
    <SafeAreaView style={authStyles.safe} edges={['top']}>
      <AuthScreenChrome>
        <View style={authStyles.flex}>
          <ScrollView
            contentContainerStyle={[
              authStyles.scroll,
              { paddingBottom: Math.max(24, insets.bottom + 16) },
            ]}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to sign in"
              onPress={() => navigation.navigate('Login')}
              style={({ pressed }) => [
                headerStyles.backRow,
                pressed && headerStyles.backRowPressed,
              ]}>
              <MaterialCommunityIcons name="chevron-left" size={22} color={colors.primary} />
              <Text style={headerStyles.backRowText}>Sign in</Text>
            </Pressable>

            <ForgotPasswordHeader headerStyles={headerStyles} accent={colors.primary} />

            <View style={authStyles.formCard}>
              <View style={authStyles.field}>
                <Text style={[authStyles.label, authStyles.labelStandalone]}>Email address</Text>
                <View style={authStyles.passwordField}>
                  <MaterialCommunityIcons
                    name="email-outline"
                    size={20}
                    color={colors.textMuted}
                    style={emailFieldStyles.leadingIcon}
                  />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@company.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    style={authStyles.passwordInput}
                  />
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  authStyles.primaryBtn,
                  pressed && authStyles.primaryBtnPressed,
                ]}
                onPress={() => {
                  // Wire to auth API later
                }}>
                <Text style={authStyles.primaryBtnText}>Send reset link</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </AuthScreenChrome>
    </SafeAreaView>
  );
}

const emailFieldStyles = StyleSheet.create({
  leadingIcon: {
    marginRight: 4,
  },
});

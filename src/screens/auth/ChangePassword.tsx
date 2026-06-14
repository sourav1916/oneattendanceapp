import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { changePassword } from '@src/api/changePassword';
import { SvgEyeOffOutline, SvgEyeOutline } from '@src/components/icons/PasswordVisibilityIcon';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { SettingsStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import { readApiError } from '@src/utils/readApiError';

/** Any non–letter/digit/whitespace counts as a special character for policy checks. */
const HAS_SPECIAL_RE = /[^A-Za-z0-9\s]/;

type NewPasswordAnalysis = {
    minLength: boolean;
    upper: boolean;
    lower: boolean;
    digit: boolean;
    special: boolean;
};

function analyzeNewPassword(password: string): NewPasswordAnalysis {
    return {
        minLength: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        digit: /\d/.test(password),
        special: HAS_SPECIAL_RE.test(password),
    };
}

function isComplexitySatisfied(analysis: NewPasswordAnalysis): boolean {
    return analysis.minLength && analysis.upper && analysis.lower && analysis.digit && analysis.special;
}

const PASSWORD_RULE_ROWS: { key: keyof NewPasswordAnalysis; i18nKey: string }[] = [
    { key: 'minLength', i18nKey: 'settings.changePassword.ruleMinLength' },
    { key: 'upper', i18nKey: 'settings.changePassword.ruleUppercase' },
    { key: 'lower', i18nKey: 'settings.changePassword.ruleLowercase' },
    { key: 'digit', i18nKey: 'settings.changePassword.ruleDigit' },
    { key: 'special', i18nKey: 'settings.changePassword.ruleSpecial' },
];

type Props = NativeStackScreenProps<SettingsStackParamList, 'ChangePassword'>;

const STACK_HEADER_HEIGHT = 52;

const SECURITY_HIGHLIGHTS = [
  { icon: 'lock-check-outline' as const, labelKey: 'settings.changePassword.highlightStrong' },
  { icon: 'key-variant' as const, labelKey: 'settings.changePassword.highlightUnique' },
  { icon: 'shield-key-outline' as const, labelKey: 'settings.changePassword.highlightProtected' },
];

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
    const isDark = scheme === 'dark';
    const accentSoft = isDark ? 'rgba(96, 165, 250, 0.14)' : 'rgba(37, 99, 235, 0.1)';
    const heroCardBg = isDark ? 'rgba(30, 41, 59, 0.72)' : '#ffffff';
    const heroCardBorder = isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(226, 232, 240, 0.95)';

    return StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: colors.background,
        },
        flex: {
            flex: 1,
        },
        stackHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
            paddingRight: 12,
            minHeight: 52,
            maxHeight: 52,
        },
        stackHeaderTitle: {
            flex: 1,
            fontSize: 17,
            fontWeight: '600',
            color: colors.text,
            marginLeft: 2,
        },
        scroll: {
            paddingHorizontal: 20,
            paddingTop: 16,
        },
        heroCard: {
            borderRadius: 22,
            padding: 20,
            marginBottom: 22,
            backgroundColor: heroCardBg,
            borderWidth: 1,
            borderColor: heroCardBorder,
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
        heroGlow: {
            position: 'absolute',
            top: -52,
            right: -36,
            width: 168,
            height: 168,
            borderRadius: 84,
            backgroundColor: accentSoft,
        },
        heroGlowSecondary: {
            position: 'absolute',
            bottom: -40,
            left: -24,
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: isDark ? 'rgba(52, 211, 153, 0.08)' : 'rgba(16, 185, 129, 0.08)',
        },
        heroTop: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 14,
            marginBottom: 14,
        },
        heroIconRing: {
            width: 64,
            height: 64,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: accentSoft,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(96, 165, 250, 0.28)' : 'rgba(37, 99, 235, 0.16)',
        },
        heroTextBlock: {
            flex: 1,
            minWidth: 0,
            paddingTop: 2,
        },
        heroEyebrow: {
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
        heroEyebrowText: {
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: colors.primary,
        },
        heroTitle: {
            fontSize: 24,
            fontWeight: '800',
            color: colors.text,
            letterSpacing: -0.4,
            lineHeight: 30,
        },
        heroSubtitle: {
            fontSize: 15,
            color: colors.textMuted,
            lineHeight: 22,
        },
        heroHighlightsRow: {
            flexDirection: 'row',
            gap: 8,
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: isDark ? 'rgba(148, 163, 184, 0.22)' : '#e2e8f0',
        },
        heroHighlightItem: {
            flex: 1,
            alignItems: 'center',
            gap: 6,
            paddingVertical: 10,
            paddingHorizontal: 6,
            borderRadius: 14,
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.55)' : '#f8fafc',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0',
        },
        heroHighlightIcon: {
            width: 32,
            height: 32,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: accentSoft,
        },
        heroHighlightLabel: {
            fontSize: 11,
            fontWeight: '700',
            color: colors.textMuted,
            textAlign: 'center',
        },
        formCard: {
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 20,
            gap: 4,
            ...Platform.select({
                ios: {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: scheme === 'dark' ? 0.35 : 0.08,
                    shadowRadius: 14,
                },
                android: { elevation: 3 },
            }),
        },
        fieldBlock: {
            marginBottom: 16,
        },
        requirementsBlock: {
            marginTop: -4,
            marginBottom: 16,
            paddingTop: 4,
        },
        requirementsTitle: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.textMuted,
            marginBottom: 8,
        },
        ruleRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            marginBottom: 6,
        },
        ruleBullet: {
            fontSize: 14,
            lineHeight: 20,
            fontWeight: '700',
            width: 18,
            textAlign: 'center',
        },
        ruleLabel: {
            flex: 1,
            fontSize: 14,
            lineHeight: 20,
        },
        ruleMet: {
            color: scheme === 'dark' ? '#86efac' : '#15803d',
        },
        ruleNeutral: {
            color: colors.textMuted,
        },
        ruleFail: {
            color: colors.danger,
        },
        confirmHint: {
            marginTop: 8,
            fontSize: 13,
            lineHeight: 18,
            color: colors.danger,
        },
        label: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 8,
        },
        passwordField: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            paddingLeft: 14,
            paddingRight: 4,
            minHeight: Platform.OS === 'ios' ? 52 : 48,
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
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderRadius: 10,
        },
        passwordTogglePressed: {
            opacity: 0.65,
        },
        divider: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.border,
            marginVertical: 8,
        },
        switchBlock: {
            marginTop: 4,
            marginBottom: 8,
        },
        switchRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
        },
        switchLabels: {
            flex: 1,
            minWidth: 0,
        },
        switchTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
        },
        switchHint: {
            fontSize: 13,
            color: colors.textMuted,
            lineHeight: 18,
        },
        errorBanner: {
            marginTop: 4,
            marginBottom: 12,
            padding: 12,
            borderRadius: 12,
            backgroundColor: scheme === 'dark' ? '#450a0a' : '#fef2f2',
            borderWidth: 1,
            borderColor: scheme === 'dark' ? '#7f1d1d' : '#fecaca',
        },
        errorText: {
            fontSize: 14,
            color: colors.danger,
            lineHeight: 20,
        },
        submitBtn: {
            marginTop: 12,
            backgroundColor: colors.primary,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 54,
        },
        submitBtnPressed: {
            backgroundColor: colors.primaryPressed,
        },
        submitBtnDisabled: {
            opacity: 0.5,
        },
        submitLabel: {
            color: '#fff',
            fontSize: 17,
            fontWeight: '700',
        },
    });
}

export function ChangePasswordScreen({ navigation }: Props) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => buildStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    const { props: confirmProps, present } = useConfirmAlert();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [keepLogin, setKeepLogin] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const newAnalysis = useMemo(() => analyzeNewPassword(newPassword.trim()), [newPassword]);

    const passwordsMatch = useMemo(() => {
        const next = newPassword.trim();
        const again = confirmPassword.trim();
        return next.length > 0 && again.length > 0 && next === again;
    }, [newPassword, confirmPassword]);

    const isFormValid = useMemo(() => {
        const cur = currentPassword.trim();
        const next = newPassword.trim();
        const again = confirmPassword.trim();
        if (!cur || !next || !again) {
            return false;
        }
        if (!isComplexitySatisfied(newAnalysis)) {
            return false;
        }
        if (next !== again) {
            return false;
        }
        if (next === cur) {
            return false;
        }
        return true;
    }, [currentPassword, newPassword, confirmPassword, newAnalysis]);

    const validate = useCallback((): string | null => {
        if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
            return t('settings.changePassword.errors.required');
        }
        if (!isComplexitySatisfied(analyzeNewPassword(newPassword.trim()))) {
            return t('settings.changePassword.errors.complexity');
        }
        if (newPassword.trim() !== confirmPassword.trim()) {
            return t('settings.changePassword.errors.mismatch');
        }
        if (newPassword.trim() === currentPassword.trim()) {
            return t('settings.changePassword.errors.sameAsOld');
        }
        return null;
    }, [currentPassword, newPassword, confirmPassword, t]);

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

    const handleSubmit = useCallback(() => {
        const err = validate();
        if (err) {
            setFormError(err);
            return;
        }
        setFormError(null);
        setSubmitting(true);
        void (async () => {
            try {
                const res = await changePassword({
                    old_password: currentPassword.trim(),
                    new_password: newPassword.trim(),
                    keep_login: keepLogin,
                });
                if (!res.success) {
                    setFormError(res.message?.trim() || t('settings.changePassword.errors.failed'));
                    return;
                }
                present({
                    title: t('settings.changePassword.successTitle'),
                    message: res.message?.trim() || t('settings.changePassword.successMessage'),
                    buttons: [
                        {
                            text: t('settings.alerts.ok'),
                            variant: 'primary',
                            onPress: () => navigation.goBack(),
                        },
                    ],
                });
            } catch (e) {
                setFormError(readApiError(e));
            } finally {
                setSubmitting(false);
            }
        })();
    }, [
        validate,
        currentPassword,
        newPassword,
        keepLogin,
        present,
        t,
        navigation,
    ]);

    const switchTrack = { false: colors.border, true: colors.primary };
    const switchThumb = (scheme: 'light' | 'dark') => (scheme === 'dark' ? '#f1f5f9' : '#fff');

    const submitDisabled = !isFormValid || submitting;

    const matchRowStatus = ruleStatusStyle(
        passwordsMatch,
        confirmPassword.trim().length > 0 &&
        newPassword.trim().length > 0 &&
        !passwordsMatch,
    );

    const keyboardVerticalOffset = insets.top + STACK_HEADER_HEIGHT;

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.flex}>
                <View style={styles.stackHeader}>
                    <HeaderBackButton
                        onPress={() => navigation.goBack()}
                        tintColor={colors.primary}
                        displayMode="minimal"
                        accessibilityLabel={t('settings.changePassword.back')}
                    />
                    <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
                        {t('settings.changePassword.title')}
                    </Text>
                </View>

                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={keyboardVerticalOffset}>
                    <ScrollView
                        style={styles.flex}
                        contentContainerStyle={[
                            styles.scroll,
                            { paddingBottom: Math.max(16, insets.bottom) },
                        ]}
                        keyboardShouldPersistTaps="handled"
                        automaticallyAdjustKeyboardInsets={Platform.OS === 'android'}
                        showsVerticalScrollIndicator={false}>
                        <View style={styles.heroCard}>
                            <View style={styles.heroGlow} />
                            <View style={styles.heroGlowSecondary} />
                            <View style={styles.heroTop}>
                                <View style={styles.heroIconRing}>
                                    <MaterialCommunityIcons
                                        name="shield-lock-outline"
                                        size={32}
                                        color={colors.primary}
                                    />
                                </View>
                                <View style={styles.heroTextBlock}>
                                    <View style={styles.heroEyebrow}>
                                        <MaterialCommunityIcons
                                            name="shield-check"
                                            size={14}
                                            color={colors.primary}
                                        />
                                        <Text style={styles.heroEyebrowText}>
                                            {t('settings.changePassword.eyebrow')}
                                        </Text>
                                    </View>
                                    <Text style={styles.heroTitle}>
                                        {t('settings.changePassword.heroTitle')}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.heroSubtitle}>
                                {t('settings.changePassword.heroSubtitle')}
                            </Text>
                            <View style={styles.heroHighlightsRow}>
                                {SECURITY_HIGHLIGHTS.map(item => (
                                    <View key={item.labelKey} style={styles.heroHighlightItem}>
                                        <View style={styles.heroHighlightIcon}>
                                            <MaterialCommunityIcons
                                                name={item.icon}
                                                size={18}
                                                color={colors.primary}
                                            />
                                        </View>
                                        <Text style={styles.heroHighlightLabel}>
                                            {t(item.labelKey)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        <View style={styles.formCard}>
                            {formError ? (
                                <View style={styles.errorBanner}>
                                    <Text style={styles.errorText}>{formError}</Text>
                                </View>
                            ) : null}

                            <View style={styles.fieldBlock}>
                                <Text style={styles.label}>{t('settings.changePassword.currentLabel')}</Text>
                                <View style={styles.passwordField}>
                                    <TextInput
                                        value={currentPassword}
                                        onChangeText={text => {
                                            setFormError(null);
                                            setCurrentPassword(text);
                                        }}
                                        placeholder={t('settings.changePassword.currentPlaceholder')}
                                        secureTextEntry={!showCurrent}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        autoComplete="password"
                                        textContentType="password"
                                        editable={!submitting}
                                        style={styles.passwordInput}
                                        placeholderTextColor={colors.textMuted}
                                    />
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={
                                            showCurrent
                                                ? t('settings.changePassword.hidePassword')
                                                : t('settings.changePassword.showPassword')
                                        }
                                        hitSlop={8}
                                        onPress={() => setShowCurrent(v => !v)}
                                        style={({ pressed }) => [
                                            styles.passwordToggle,
                                            pressed && styles.passwordTogglePressed,
                                        ]}>
                                        {showCurrent ? (
                                            <SvgEyeOffOutline size={22} color={colors.textMuted} />
                                        ) : (
                                            <SvgEyeOutline size={22} color={colors.textMuted} />
                                        )}
                                    </Pressable>
                                </View>
                            </View>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.label}>{t('settings.changePassword.newLabel')}</Text>
                                <View style={styles.passwordField}>
                                    <TextInput
                                        value={newPassword}
                                        onChangeText={text => {
                                            setFormError(null);
                                            setNewPassword(text);
                                        }}
                                        placeholder={t('settings.changePassword.newPlaceholder')}
                                        secureTextEntry={!showNew}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        autoComplete="password-new"
                                        textContentType="newPassword"
                                        editable={!submitting}
                                        style={styles.passwordInput}
                                        placeholderTextColor={colors.textMuted}
                                    />
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={
                                            showNew
                                                ? t('settings.changePassword.hidePassword')
                                                : t('settings.changePassword.showPassword')
                                        }
                                        hitSlop={8}
                                        onPress={() => setShowNew(v => !v)}
                                        style={({ pressed }) => [
                                            styles.passwordToggle,
                                            pressed && styles.passwordTogglePressed,
                                        ]}>
                                        {showNew ? (
                                            <SvgEyeOffOutline size={22} color={colors.textMuted} />
                                        ) : (
                                            <SvgEyeOutline size={22} color={colors.textMuted} />
                                        )}
                                    </Pressable>
                                </View>
                            </View>

                            <View style={styles.requirementsBlock}>
                                <Text style={styles.requirementsTitle}>
                                    {t('settings.changePassword.requirementsTitle')}
                                </Text>
                                {PASSWORD_RULE_ROWS.map(({ key, i18nKey }) => {
                                    const ok = newAnalysis[key];
                                    const showFailure = newPassword.trim().length > 0 && !ok;
                                    const status = ruleStatusStyle(ok, showFailure);
                                    return (
                                        <View key={key} style={styles.ruleRow}>
                                            <Text style={[styles.ruleBullet, status]}>{ok ? '✓' : '○'}</Text>
                                            <Text style={[styles.ruleLabel, status]}>{t(i18nKey)}</Text>
                                        </View>
                                    );
                                })}
                                <View style={styles.ruleRow}>
                                    <Text style={[styles.ruleBullet, matchRowStatus]}>
                                        {passwordsMatch ? '✓' : '○'}
                                    </Text>
                                    <Text style={[styles.ruleLabel, matchRowStatus]}>
                                        {t('settings.changePassword.ruleMatch')}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.label}>{t('settings.changePassword.confirmLabel')}</Text>
                                <View style={styles.passwordField}>
                                    <TextInput
                                        value={confirmPassword}
                                        onChangeText={text => {
                                            setFormError(null);
                                            setConfirmPassword(text);
                                        }}
                                        placeholder={t('settings.changePassword.confirmPlaceholder')}
                                        secureTextEntry={!showConfirm}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        autoComplete="password-new"
                                        textContentType="newPassword"
                                        editable={!submitting}
                                        style={styles.passwordInput}
                                        placeholderTextColor={colors.textMuted}
                                    />
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={
                                            showConfirm
                                                ? t('settings.changePassword.hidePassword')
                                                : t('settings.changePassword.showPassword')
                                        }
                                        hitSlop={8}
                                        onPress={() => setShowConfirm(v => !v)}
                                        style={({ pressed }) => [
                                            styles.passwordToggle,
                                            pressed && styles.passwordTogglePressed,
                                        ]}>
                                        {showConfirm ? (
                                            <SvgEyeOffOutline size={22} color={colors.textMuted} />
                                        ) : (
                                            <SvgEyeOutline size={22} color={colors.textMuted} />
                                        )}
                                    </Pressable>
                                </View>
                                {confirmPassword.trim().length > 0 &&
                                    newPassword.trim() !== confirmPassword.trim() ? (
                                    <Text style={styles.confirmHint}>
                                        {t('settings.changePassword.confirmMismatchHint')}
                                    </Text>
                                ) : null}
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.switchBlock}>
                                <View style={styles.switchRow}>
                                    <View style={styles.switchLabels}>
                                        <Text style={styles.switchTitle}>{t('settings.changePassword.keepSessionsLabel')}</Text>
                                        <Text style={styles.switchHint}>{t('settings.changePassword.keepSessionsHint')}</Text>
                                    </View>
                                    <Switch
                                        accessibilityRole="switch"
                                        accessibilityLabel={t('settings.changePassword.keepSessionsLabel')}
                                        value={keepLogin}
                                        onValueChange={setKeepLogin}
                                        disabled={submitting}
                                        trackColor={switchTrack}
                                        thumbColor={switchThumb(resolvedScheme)}
                                        ios_backgroundColor={colors.border}
                                    />
                                </View>
                            </View>

                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ disabled: submitDisabled }}
                                onPress={handleSubmit}
                                disabled={submitDisabled}
                                style={({ pressed }) => [
                                    styles.submitBtn,
                                    pressed && !submitDisabled && styles.submitBtnPressed,
                                    submitDisabled && styles.submitBtnDisabled,
                                ]}>
                                {submitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.submitLabel}>{t('settings.changePassword.submit')}</Text>
                                )}
                            </Pressable>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
            <ConfirmAlert {...confirmProps} />
        </SafeAreaView>
    );
}

import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
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
            paddingTop: 20,
            paddingBottom: 40,
        },
        heroWrap: {
            marginBottom: 22,
            paddingLeft: 14,
            borderLeftWidth: 4,
            borderLeftColor: colors.primary,
        },
        eyebrow: {
            fontSize: 12,
            fontWeight: '700',
            color: colors.primary,
            textTransform: 'uppercase',
            letterSpacing: 0.9,
            marginBottom: 6,
        },
        heroTitle: {
            fontSize: 26,
            fontWeight: '800',
            color: colors.text,
            letterSpacing: -0.5,
            marginBottom: 8,
        },
        heroSubtitle: {
            fontSize: 15,
            color: colors.textMuted,
            lineHeight: 22,
            maxWidth: 360,
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
    const styles = useMemo(() => buildStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    const { props: confirmProps, present } = useConfirmAlert();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [keepOtherSessions, setKeepOtherSessions] = useState(false);
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
                    current_password: currentPassword.trim(),
                    new_password: newPassword.trim(),
                    keep_other_sessions: keepOtherSessions,
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
        keepOtherSessions,
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

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
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

            <View style={styles.flex}>
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets
                    showsVerticalScrollIndicator={false}>
                    <View style={styles.heroWrap}>
                        <Text style={styles.eyebrow}>{t('settings.changePassword.eyebrow')}</Text>
                        <Text style={styles.heroTitle}>{t('settings.changePassword.heroTitle')}</Text>
                        <Text style={styles.heroSubtitle}>{t('settings.changePassword.heroSubtitle')}</Text>
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
                                    value={keepOtherSessions}
                                    onValueChange={setKeepOtherSessions}
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
            </View>
            <ConfirmAlert {...confirmProps} />
        </SafeAreaView>
    );
}

import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { purchaseSubscription } from '@src/api/purchaseSubscription';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import {
    StatusAlert,
    useStatusAlert,
} from '@src/components/modals/StatusAlert';
import { BillingPeriodSelector } from '@src/components/subscription/BillingPeriodSelector';
import { EmployeeRangeSlider } from '@src/components/subscription/EmployeeRangeSlider';
import {
    TAB_SCREEN_SAFE_AREA_EDGES,
    TAB_SCREEN_SCROLL_PADDING_BOTTOM,
} from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useSubscriptionPackages } from '@src/hooks/useSubscriptionPackages';
import type { SettingsStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import {
    resolveLayerPaymentToken,
    type SubscriptionPeriod,
} from '@src/types/subscriptionPackage';
import {
    parsePurchaseSubscriptionError,
    parsePurchaseSubscriptionMessage,
    type ParsedPurchaseSubscriptionError,
} from '@src/utils/parsePurchaseSubscriptionError';
import {
    defaultPeriodForPackage,
    formatSubscriptionPrice,
    getBillingOptions,
    getPackagePrice,
    packageAtIndex,
} from '@src/utils/subscriptionBilling';
import {
  isZwitchAccessNotAllowedError,
  isZwitchPaymentCancelled,
  isZwitchPaymentSuccess,
  readZwitchPaymentError,
  startZwitchSubscriptionPayment,
} from '@src/utils/zwitchPayment';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Subscription'>;

const ACCENT = '#4f46e5';

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
    const dark = scheme === 'dark';
    return StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        fill: { flex: 1 },
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
            fontWeight: '700',
            color: colors.text,
            marginLeft: 2,
        },
        scroll: {
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM + 72,
        },
        hero: {
            borderRadius: 16,
            padding: 18,
            marginBottom: 20,
            backgroundColor: dark ? 'rgba(79,70,229,0.22)' : '#eef2ff',
            borderWidth: 1,
            borderColor: dark ? 'rgba(129,140,248,0.35)' : '#c7d2fe',
        },
        heroTitle: {
            fontSize: 18,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 6,
        },
        heroSubtitle: {
            fontSize: 14,
            lineHeight: 20,
            color: colors.textMuted,
        },
        ownerBanner: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            padding: 12,
            borderRadius: 12,
            marginBottom: 16,
            backgroundColor: dark ? 'rgba(251,191,36,0.12)' : '#fffbeb',
            borderWidth: 1,
            borderColor: dark ? 'rgba(251,191,36,0.35)' : '#fde68a',
        },
        ownerBannerText: {
            flex: 1,
            fontSize: 13,
            lineHeight: 18,
            color: dark ? '#fbbf24' : '#b45309',
        },
        centerBox: {
            paddingVertical: 48,
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 24,
        },
        muted: {
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 20,
        },
        error: {
            fontSize: 14,
            color: colors.danger,
            textAlign: 'center',
            lineHeight: 20,
        },
        retryBtn: {
            marginTop: 4,
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 10,
            backgroundColor: colors.primary,
        },
        retryLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
        sliderCard: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            marginBottom: 16,
            ...Platform.select({
                ios: {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: dark ? 0.2 : 0.06,
                    shadowRadius: 6,
                },
                android: { elevation: 1 },
            }),
        },
        priceCard: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 18,
            marginBottom: 16,
            alignItems: 'center',
        },
        planName: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.textMuted,
            marginBottom: 8,
        },
        amount: {
            fontSize: 36,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 4,
        },
        amountPeriod: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 4,
        },
        billingCard: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            paddingTop: 22,
            marginBottom: 16,
            overflow: 'visible',
            ...Platform.select({
                ios: {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: dark ? 0.2 : 0.06,
                    shadowRadius: 6,
                },
                android: { elevation: 1 },
            }),
        },
        footer: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: Platform.OS === 'ios' ? 28 : 16,
            backgroundColor: colors.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        subscribeBtn: {
            minHeight: 48,
            borderRadius: 12,
            backgroundColor: ACCENT,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
        },
        subscribeBtnDisabled: { opacity: 0.5 },
        subscribeBtnPressed: { opacity: 0.9 },
        subscribeBtnLabel: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '700',
        },
    });
}

export function SubscriptionScreen({ navigation }: Props) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const dark = resolvedScheme === 'dark';
    const styles = useMemo(
        () => buildStyles(colors, resolvedScheme),
        [colors, resolvedScheme],
    );
    const { selectedCompany } = useAuth();
    const companyId = selectedCompany?.id ?? null;
    const isOwner = selectedCompany?.relation === 'owned';

    const { props: statusProps, presentError, presentSuccess } = useStatusAlert();
    const { props: confirmProps, present: presentConfirm } = useConfirmAlert();
    const { packages, loading, error, retry } =
        useSubscriptionPackages(companyId);

    const [selectedIndex, setSelectedIndex] = useState(0);
    const [selectedPeriod, setSelectedPeriod] = useState<SubscriptionPeriod | null>(
        null,
    );
    const [purchasing, setPurchasing] = useState(false);

    useEffect(() => {
        if (packages.length === 0) {
            setSelectedIndex(0);
            setSelectedPeriod(null);
            return;
        }
        setSelectedIndex(prev =>
            prev >= 0 && prev < packages.length ? prev : 0,
        );
    }, [packages]);

    const selectedPackage = useMemo(
        () => packageAtIndex(packages, selectedIndex),
        [packages, selectedIndex],
    );

    useEffect(() => {
        if (selectedPackage == null) {
            setSelectedPeriod(null);
            return;
        }
        const options = getBillingOptions(selectedPackage);
        if (options.length === 0) {
            setSelectedPeriod(null);
            return;
        }
        setSelectedPeriod(prev => {
            if (prev != null && options.some(o => o.key === prev)) {
                return prev;
            }
            return defaultPeriodForPackage(selectedPackage);
        });
    }, [selectedPackage]);

    const billingOptions = useMemo(
        () => (selectedPackage != null ? getBillingOptions(selectedPackage) : []),
        [selectedPackage],
    );

    const selectedPrice = useMemo(() => {
        if (selectedPackage == null || selectedPeriod == null) {
            return null;
        }
        return getPackagePrice(selectedPackage, selectedPeriod);
    }, [selectedPackage, selectedPeriod]);

    const selectedPeriodLabel = useMemo(() => {
        const opt = billingOptions.find(o => o.key === selectedPeriod);
        return opt != null ? t(opt.labelKey) : '';
    }, [billingOptions, selectedPeriod, t]);

    const employeeRangeFor = useCallback(
        (pkg: { min_employee_count: number; max_employee_count: number }) =>
            t('settings.subscriptionScreen.employeeRange', {
                min: pkg.min_employee_count,
                max: pkg.max_employee_count,
            }),
        [t],
    );

    const presentPurchaseFailure = useCallback(
        (parsed: ParsedPurchaseSubscriptionError) => {
            const message =
                parsed.isOwnerForbidden
                    ? t('settings.subscriptionScreen.errors.ownerOnly')
                    : parsed.message;

            if (parsed.profileField != null) {
                presentConfirm({
                    title: t('settings.subscriptionScreen.errors.profileRequiredTitle'),
                    message,
                    showMessage: true,
                    buttons: [
                        {
                            text: t('settings.subscriptionScreen.errors.cancel'),
                            variant: 'secondary',
                        },
                        {
                            text: t('settings.subscriptionScreen.errors.updateProfile'),
                            variant: 'primary',
                            onPress: () => {
                                navigation.navigate('Profile');
                            },
                        },
                    ],
                });
                return;
            }

            presentError({
                title: t('settings.subscriptionScreen.errors.purchaseTitle'),
                message,
            });
        },
        [navigation, presentConfirm, presentError, t],
    );

    const handlePurchaseError = useCallback(
        (err: unknown) => {
            presentPurchaseFailure(parsePurchaseSubscriptionError(err));
        },
        [presentPurchaseFailure],
    );

    const presentZwitchPaymentError = useCallback(
        (err: unknown) => {
            const message = readZwitchPaymentError(err);
            if (isZwitchAccessNotAllowedError(message)) {
                presentConfirm({
                    title: t(
                        'settings.subscriptionScreen.errors.accessNotAllowedTitle',
                    ),
                    message: `${message}\n\n${t(
                        'settings.subscriptionScreen.errors.accessNotAllowedHint',
                    )}`,
                    showMessage: true,
                    buttons: [
                        {
                            text: t('settings.subscriptionScreen.errors.cancel'),
                            variant: 'secondary',
                        },
                        {
                            text: t(
                                'settings.subscriptionScreen.errors.contactSupport',
                            ),
                            variant: 'primary',
                            onPress: () => {
                                navigation.navigate('Support');
                            },
                        },
                    ],
                });
                return;
            }
            presentError({
                title: t('settings.subscriptionScreen.errors.paymentTitle'),
                message,
            });
        },
        [navigation, presentConfirm, presentError, t],
    );

    const presentPaymentOutcome = useCallback(
        (status: string) => {
            if (isZwitchPaymentSuccess(status)) {
                presentSuccess({
                    title: t('settings.subscriptionScreen.paymentSuccessTitle'),
                    message: t('settings.subscriptionScreen.paymentSuccessMessage'),
                });
                return;
            }
            if (isZwitchPaymentCancelled(status)) {
                presentError({
                    title: t('settings.subscriptionScreen.paymentCancelledTitle'),
                    message: t('settings.subscriptionScreen.paymentCancelledMessage'),
                });
                return;
            }
            presentError({
                title: t('settings.subscriptionScreen.paymentFailedTitle'),
                message: t('settings.subscriptionScreen.paymentFailedMessage', {
                    status: status.trim() || 'unknown',
                }),
            });
        },
        [presentError, presentSuccess, t],
    );

    const handleSubscribe = useCallback(() => {
        if (
            companyId == null ||
            !isOwner ||
            selectedPackage == null ||
            selectedPeriod == null ||
            selectedPrice == null ||
            purchasing
        ) {
            return;
        }

        const runPurchase = async () => {
            setPurchasing(true);
            try {
                const res = await purchaseSubscription(companyId, {
                    package_id: selectedPackage.id,
                    package_period: selectedPeriod,
                });

                if (!res.success) {
                    presentPurchaseFailure(
                        parsePurchaseSubscriptionMessage(
                            res.message?.trim() ||
                            t('settings.subscriptionScreen.errors.purchaseGeneric'),
                        ),
                    );
                    return;
                }

                const isPaid = selectedPrice > 0;
                if (isPaid) {
                    const token = resolveLayerPaymentToken(res.data);
                    if (!token) {
                        presentError({
                            title: t('settings.subscriptionScreen.errors.purchaseTitle'),
                            message: t(
                                'settings.subscriptionScreen.errors.missingPaymentToken',
                            ),
                        });
                        return;
                    }

                    try {
                        const result = await startZwitchSubscriptionPayment(token);
                        presentPaymentOutcome(result.status);
                    } catch (payErr) {
                        presentZwitchPaymentError(payErr);
                    }
                    return;
                }

                presentSuccess({
                    title: t('settings.subscriptionScreen.successTitle'),
                    message:
                        res.message?.trim() ||
                        t('settings.subscriptionScreen.successMessage'),
                });
            } catch (err) {
                handlePurchaseError(err);
            } finally {
                setPurchasing(false);
            }
        };

        runPurchase().catch(err => {
            presentError({
                title: t('settings.subscriptionScreen.errors.purchaseTitle'),
                message: readZwitchPaymentError(err),
            });
            setPurchasing(false);
        });
    }, [
        companyId,
        handlePurchaseError,
        isOwner,
        presentPaymentOutcome,
        presentPurchaseFailure,
        presentError,
        presentSuccess,
        presentZwitchPaymentError,
        purchasing,
        selectedPackage,
        selectedPeriod,
        selectedPrice,
        t,
    ]);

    const subscribeLabel = useMemo(() => {
        if (selectedPrice == null) {
            return t('settings.subscriptionScreen.subscribe');
        }
        if (selectedPrice <= 0) {
            return t('settings.subscriptionScreen.activateFree');
        }
        return t('settings.subscriptionScreen.payNowWithAmount', {
            amount: formatSubscriptionPrice(selectedPrice),
        });
    }, [selectedPrice, t]);

    const showFooter =
        !loading &&
        error == null &&
        packages.length > 0 &&
        selectedPackage != null &&
        selectedPeriod != null &&
        selectedPrice != null;

    const sliderColors = useMemo(
        () => ({
            accent: ACCENT,
            trackColor: dark ? '#334155' : '#e2e8f0',
            fillColor: dark ? 'rgba(79,70,229,0.55)' : '#c7d2fe',
            thumbBorderColor: colors.surface,
            labelColor: colors.textMuted,
            labelActiveColor: colors.text,
            hintColor: colors.textMuted,
        }),
        [colors.surface, colors.text, colors.textMuted, dark],
    );

    return (
        <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
            <View style={styles.stackHeader}>
                <HeaderBackButton
                    onPress={() => navigation.goBack()}
                    tintColor={colors.primary}
                    displayMode="minimal"
                    accessibilityLabel={t('settings.subscriptionScreen.back')}
                />
                <Text style={styles.stackHeaderTitle} numberOfLines={1}>
                    {t('settings.subscriptionScreen.title')}
                </Text>
            </View>

            <View style={styles.fill}>
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                >
                    <View style={styles.hero}>
                        <Text style={styles.heroTitle}>
                            {t('settings.subscriptionScreen.heroTitle')}
                        </Text>
                        <Text style={styles.heroSubtitle}>
                            {t('settings.subscriptionScreen.heroSubtitle')}
                        </Text>
                    </View>

                    {!isOwner ? (
                        <View style={styles.ownerBanner}>
                            <MaterialCommunityIcons
                                name="information-outline"
                                size={20}
                                color={dark ? '#fbbf24' : '#b45309'}
                            />
                            <Text style={styles.ownerBannerText}>
                                {t('settings.subscriptionScreen.ownerOnlyHint')}
                            </Text>
                        </View>
                    ) : null}

                    {companyId == null ? (
                        <View style={styles.centerBox}>
                            <Text style={styles.muted}>
                                {t('settings.subscriptionScreen.noCompany')}
                            </Text>
                        </View>
                    ) : loading ? (
                        <View style={styles.centerBox}>
                            <ActivityIndicator color={ACCENT} size="large" />
                            <Text style={styles.muted}>
                                {t('settings.subscriptionScreen.loading')}
                            </Text>
                        </View>
                    ) : error ? (
                        <View style={styles.centerBox}>
                            <Text style={styles.error}>{error}</Text>
                            <Pressable
                                style={styles.retryBtn}
                                onPress={retry}
                                accessibilityRole="button"
                            >
                                <Text style={styles.retryLabel}>
                                    {t('settings.subscriptionScreen.retry')}
                                </Text>
                            </Pressable>
                        </View>
                    ) : packages.length === 0 ? (
                        <View style={styles.centerBox}>
                            <MaterialCommunityIcons
                                name="package-variant"
                                size={40}
                                color={colors.textMuted}
                            />
                            <Text style={styles.muted}>
                                {t('settings.subscriptionScreen.empty')}
                            </Text>
                        </View>
                    ) : (
                        <>
                            <View style={styles.sliderCard}>
                                <EmployeeRangeSlider
                                    packages={packages}
                                    selectedIndex={selectedIndex}
                                    onSelectIndex={setSelectedIndex}
                                    rangeLabel={employeeRangeFor}
                                    sectionLabel={t('settings.subscriptionScreen.teamSizeLabel')}
                                    hint={t('settings.subscriptionScreen.sliderHint')}
                                    {...sliderColors}
                                />
                            </View>

                            {selectedPackage != null && selectedPrice != null ? (
                                <View style={styles.priceCard}>
                                    <Text style={styles.planName}>
                                        {t('settings.subscriptionScreen.planLabel', {
                                            name: selectedPackage.name,
                                        })}
                                    </Text>
                                    <Text style={styles.amount}>
                                        {formatSubscriptionPrice(selectedPrice)}
                                    </Text>
                                    <Text style={styles.amountPeriod}>
                                        {t('settings.subscriptionScreen.perPeriod', {
                                            period: selectedPeriodLabel,
                                        })}
                                    </Text>
                                </View>
                            ) : null}

                            {selectedPackage != null ? (
                                <View style={styles.billingCard}>
                                    <BillingPeriodSelector
                                        pkg={selectedPackage}
                                        selectedPeriod={selectedPeriod}
                                        onSelectPeriod={setSelectedPeriod}
                                        colors={colors}
                                        dark={dark}
                                        sectionLabel={t(
                                            'settings.subscriptionScreen.billingPeriod',
                                        )}
                                    />
                                </View>
                            ) : null}
                        </>
                    )}
                </ScrollView>

                {showFooter ? (
                    <View style={styles.footer}>
                        <Pressable
                            accessibilityRole="button"
                            disabled={!isOwner || purchasing}
                            onPress={handleSubscribe}
                            style={({ pressed }) => [
                                styles.subscribeBtn,
                                (!isOwner || purchasing) && styles.subscribeBtnDisabled,
                                pressed && isOwner && !purchasing && styles.subscribeBtnPressed,
                            ]}
                        >
                            {purchasing ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons
                                        name={
                                            selectedPrice != null && selectedPrice <= 0
                                                ? 'check-circle-outline'
                                                : 'credit-card-outline'
                                        }
                                        size={20}
                                        color="#fff"
                                    />
                                    <Text style={styles.subscribeBtnLabel}>{subscribeLabel}</Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                ) : null}
            </View>

            <StatusAlert {...statusProps} />
            <ConfirmAlert {...confirmProps} />
        </SafeAreaView>
    );
}

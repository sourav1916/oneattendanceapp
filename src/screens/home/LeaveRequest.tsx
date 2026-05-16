import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchMyLeaveBalance } from '@src/api/fetchMyLeaveBalance';
import { ApplyLeave, type ApplyLeavePayload } from '@src/components/modals/ApplyLeave';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { LeaveBalanceEntry } from '@src/types/leaveBalance';
import { readApiError } from '@src/utils/readApiError';

type Props = NativeStackScreenProps<HomeStackParamList, 'LeaveRequest'>;

function humanizeLeaveKey(key: string): string {
    return key
        .split('_')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
    return StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: colors.background,
        },
        fill: {
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
            paddingBottom: 32,
        },
        centerBox: {
            paddingVertical: 40,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
        },
        muted: {
            fontSize: 15,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 22,
            paddingHorizontal: 12,
        },
        error: {
            fontSize: 15,
            color: colors.danger,
            textAlign: 'center',
            lineHeight: 22,
            paddingHorizontal: 12,
        },
        retryBtn: {
            marginTop: 8,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 12,
            backgroundColor: colors.primary,
        },
        retryLabel: {
            color: '#fff',
            fontWeight: '600',
            fontSize: 16,
        },
        card: {
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            marginBottom: 12,
            ...Platform.select({
                ios: {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: scheme === 'dark' ? 0.2 : 0.06,
                    shadowRadius: 4,
                },
                android: { elevation: 1 },
            }),
        },
        cardTitle: {
            fontSize: 17,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 4,
        },
        cardCode: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.primary,
            marginBottom: 12,
        },
        badgeRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 12,
        },
        badge: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: scheme === 'dark' ? '#334155' : colors.secondaryButton,
            borderWidth: 1,
            borderColor: colors.border,
        },
        badgeText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.text,
        },
        statRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 8,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        statLabel: {
            fontSize: 14,
            color: colors.textMuted,
        },
        statValue: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
        },
        progressTrack: {
            height: 8,
            borderRadius: 4,
            backgroundColor: scheme === 'dark' ? '#334155' : colors.secondaryButton,
            overflow: 'hidden',
            marginTop: 4,
        },
        progressFill: {
            height: '100%',
            borderRadius: 4,
            backgroundColor: colors.primary,
        },
        meta: {
            marginTop: 10,
            fontSize: 12,
            color: colors.textMuted,
            lineHeight: 17,
        },
        applyButton: {
            marginTop: 14,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: 'center',
        },
        applyButtonPressed: {
            opacity: 0.92,
        },
        applyButtonLabel: {
            color: '#fff',
            fontWeight: '600',
            fontSize: 16,
        },
    });
}

export function LeaveRequestScreen({ navigation }: Props) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const styles = useMemo(
        () => buildStyles(colors, resolvedScheme),
        [colors, resolvedScheme],
    );
    const { selectedCompany } = useAuth();

    const [rows, setRows] = useState<[string, LeaveBalanceEntry][]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [applyTarget, setApplyTarget] = useState<{
        slug: string;
        displayName: string;
        entry: LeaveBalanceEntry;
    } | null>(null);

    const { props: confirmProps, present } = useConfirmAlert();

    const companyId = selectedCompany?.id ?? null;

    const load = useCallback(async () => {
        if (companyId == null) {
            setError(null);
            setRows([]);
            setLoading(false);
            return;
        }
        setError(null);
        try {
            const res = await fetchMyLeaveBalance(companyId);
            if (!res.success) {
                setError(res.message || t('home.leaveRequest.apiError'));
                setRows([]);
                return;
            }
            const entries = Object.entries(res.data ?? {}).sort(([a], [b]) => a.localeCompare(b));
            setRows(entries);
        } catch (e) {
            setError(readApiError(e));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [companyId, t]);

    useEffect(() => {
        setLoading(true);
        void load();
    }, [load]);

    const onRefresh = useCallback(async () => {
        if (companyId == null) {
            return;
        }
        setRefreshing(true);
        try {
            await load();
        } finally {
            setRefreshing(false);
        }
    }, [companyId, load]);

    const handleApplySubmit = useCallback(
        async (_payload: ApplyLeavePayload) => {
            await load();
            present({
                title: t('home.leaveRequest.applySuccessTitle'),
                message: t('home.leaveRequest.applySuccessMessage'),
                buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
            });
        },
        [present, t, load],
    );

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
            <View style={styles.stackHeader}>
                <HeaderBackButton
                    onPress={() => navigation.goBack()}
                    tintColor={colors.primary}
                    displayMode="minimal"
                    accessibilityLabel={t('home.leaveRequest.back')}
                />
                <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
                    {t('home.leaveRequest.title')}
                </Text>
            </View>

            {companyId == null ? (
                <View style={[styles.centerBox, styles.fill]}>
                    <Text style={styles.muted}>{t('home.leaveRequest.noCompany')}</Text>
                </View>
            ) : loading ? (
                <View style={[styles.centerBox, styles.fill]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.muted}>{t('home.leaveRequest.loading')}</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.fill}
                    contentContainerStyle={styles.scroll}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets
                    showsVerticalScrollIndicator={false}>
                    {error ? (
                        <View style={styles.centerBox}>
                            <Text style={styles.error}>{error}</Text>
                            <Pressable
                                accessibilityRole="button"
                                onPress={() => void load()}
                                style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}>
                                <Text style={styles.retryLabel}>{t('home.leaveRequest.retry')}</Text>
                            </Pressable>
                        </View>
                    ) : rows.length === 0 ? (
                        <View style={styles.centerBox}>
                            <Text style={styles.muted}>{t('home.leaveRequest.empty')}</Text>
                        </View>
                    ) : (
                        rows.map(([key, leave]) => {
                            const usedRatio =
                                leave.total > 0 ? Math.min(100, Math.round((leave.used / leave.total) * 100)) : 0;
                            return (
                                <View key={key} style={styles.card}>
                                    <Text style={styles.cardTitle}>{humanizeLeaveKey(key)}</Text>
                                    <Text style={styles.cardCode}>
                                        {t('home.leaveRequest.code')}: {leave.code}
                                    </Text>
                                    <View style={styles.badgeRow}>
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>
                                                {leave.is_paid ? t('home.leaveRequest.paid') : t('home.leaveRequest.unpaid')}
                                            </Text>
                                        </View>
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>
                                                {t('home.leaveRequest.halfDay')}:{' '}
                                                {leave.allow_half_day ? t('home.leaveRequest.yes') : t('home.leaveRequest.no')}
                                            </Text>
                                        </View>
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>
                                                {t('home.leaveRequest.weekends')}:{' '}
                                                {leave.exclude_weekends ? t('home.leaveRequest.yes') : t('home.leaveRequest.no')}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.statRow}>
                                        <Text style={styles.statLabel}>{t('home.leaveRequest.total')}</Text>
                                        <Text style={styles.statValue}>{leave.total}</Text>
                                    </View>
                                    <View style={styles.statRow}>
                                        <Text style={styles.statLabel}>{t('home.leaveRequest.used')}</Text>
                                        <Text style={styles.statValue}>{leave.used}</Text>
                                    </View>
                                    <View style={styles.statRow}>
                                        <Text style={styles.statLabel}>{t('home.leaveRequest.remaining')}</Text>
                                        <Text style={styles.statValue}>{leave.remaining}</Text>
                                    </View>
                                    {leave.total > 0 ? (
                                        <View style={styles.progressTrack} accessibilityRole="progressbar">
                                            <View style={[styles.progressFill, { width: `${usedRatio}%` }]} />
                                        </View>
                                    ) : null}
                                    <Text style={styles.meta}>
                                        {t('home.leaveRequest.carryForward', { count: leave.carry_forward_limit })}
                                    </Text>
                                    {leave.remaining > 0 ? (
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel={t('home.leaveRequest.apply')}
                                            onPress={() =>
                                                setApplyTarget({
                                                    slug: key,
                                                    displayName: humanizeLeaveKey(key),
                                                    entry: leave,
                                                })
                                            }
                                            style={({ pressed }) => [
                                                styles.applyButton,
                                                pressed && styles.applyButtonPressed,
                                            ]}>
                                            <Text style={styles.applyButtonLabel}>{t('home.leaveRequest.apply')}</Text>
                                        </Pressable>
                                    ) : null}
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            )}
            {applyTarget != null ? (
                <ApplyLeave
                    visible
                    onDismiss={() => setApplyTarget(null)}
                    leaveSlug={applyTarget.slug}
                    leaveDisplayName={applyTarget.displayName}
                    entry={applyTarget.entry}
                    onSubmit={handleApplySubmit}
                />
            ) : null}
            <ConfirmAlert {...confirmProps} />
        </SafeAreaView>
    );
}

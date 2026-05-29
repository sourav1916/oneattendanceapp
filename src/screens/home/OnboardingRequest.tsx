/**
 * @format
 */
import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { inviteApi } from '@src/api/inviteApi';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { StatusAlert, useStatusAlert } from '@src/components/modals/StatusAlert';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { InviteRecord, InviteStatus } from '@src/types/invite';
import { API_ENDPOINT } from '@src/utils/config';
import { readApiError } from '@src/utils/readApiError';

type Props = NativeStackScreenProps<HomeStackParamList, 'OnboardingRequest'>;

const PAGE_LIMIT = 10;
const DEBOUNCE_MS = 500;

const STATUS_FILTERS: Array<{ key: string; labelKey: string }> = [
    { key: 'all', labelKey: 'home.onboarding.filterAll' },
    { key: 'pending', labelKey: 'home.onboarding.filterPending' },
    { key: 'accepted', labelKey: 'home.onboarding.filterAccepted' },
    { key: 'rejected', labelKey: 'home.onboarding.filterRejected' },
    { key: 'cancelled', labelKey: 'home.onboarding.filterCancelled' },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
}

function canAct(invite: InviteRecord): boolean {
    return invite.status === 'pending' && !isExpired(invite.expires_at);
}

function formatDisplay(str: unknown): string {
    if (!str) {
        return 'N/A';
    }
    if (typeof str === 'object' && str !== null && 'label' in (str as Record<string, unknown>)) {
        return (str as { label: string }).label || 'N/A';
    }
    return String(str)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

function normalizeDuration(
    value: string | number | null | undefined,
    fallback: string,
): string {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }
    if (typeof value === 'number') {
        const h = Math.floor(value / 60);
        const m = value % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (typeof value !== 'string') {
        return fallback;
    }
    const [h = '00', m = '00'] = value.split(':');
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDurationDisplay(value: string | number | null | undefined): string {
    const n = normalizeDuration(value, '00:00');
    const [h, m] = n.split(':').map(Number);
    if (h === 0 && m === 0) {
        return '0m';
    }
    if (h === 0) {
        return `${m}m`;
    }
    if (m === 0) {
        return `${h}h`;
    }
    return `${h}h ${m}m`;
}

function formatDate(date: string): string {
    if (!date) {
        return 'N/A';
    }
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
        return date;
    }
    return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function resolveLogoUrl(url: string | null): string | null {
    if (!url || !url.trim()) {
        return null;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    return `${API_ENDPOINT}${url.startsWith('/') ? '' : '/'}${url}`;
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return (name.trim()[0] || '?').toUpperCase();
}

function displayStatus(invite: InviteRecord): {
    label: string;
    key: InviteStatus | 'expired';
} {
    if (isExpired(invite.expires_at)) {
        return { label: 'expired', key: 'expired' };
    }
    return { label: invite.status, key: invite.status };
}

function statusColor(
    key: InviteStatus | 'expired',
    scheme: 'light' | 'dark',
): { bg: string; fg: string } {
    switch (key) {
        case 'pending':
            return scheme === 'dark'
                ? { bg: 'rgba(251,191,36,0.15)', fg: '#fbbf24' }
                : { bg: '#fffbeb', fg: '#b45309' };
        case 'accepted':
            return scheme === 'dark'
                ? { bg: 'rgba(34,197,94,0.15)', fg: '#4ade80' }
                : { bg: '#f0fdf4', fg: '#15803d' };
        case 'rejected':
        case 'cancelled':
            return scheme === 'dark'
                ? { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' }
                : { bg: '#f8fafc', fg: '#64748b' };
        case 'expired':
            return scheme === 'dark'
                ? { bg: 'rgba(239,68,68,0.15)', fg: '#f87171' }
                : { bg: '#fef2f2', fg: '#b91c1c' };
    }
}

function locationString(
    city: string | null,
    state: string | null,
): string {
    return [city, state].filter(Boolean).join(', ') || 'N/A';
}

// ---------------------------------------------------------------------------
// Skeleton placeholder
// ---------------------------------------------------------------------------

function SkeletonCard({
    colors,
    scheme,
}: {
    colors: AppThemeColors;
    scheme: 'light' | 'dark';
}) {
    const pulseRef = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseRef, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseRef, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [pulseRef]);

    const barBg = scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const sty = useMemo(() => buildSkeletonStyles(colors, barBg), [colors, barBg]);

    return (
        <Animated.View style={[sty.card, { opacity: pulseRef }]}>
            <View style={sty.row}>
                <View style={sty.avatar} />
                <View style={sty.textCol}>
                    <View style={sty.barWide} />
                    <View style={sty.barMedium} />
                </View>
            </View>
            <View style={sty.chipRow}>
                <View style={sty.chip} />
                <View style={sty.chip} />
            </View>
            <View style={sty.barNarrow} />
        </Animated.View>
    );
}

function buildSkeletonStyles(colors: AppThemeColors, barBg: string) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 12,
            marginBottom: 8,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
        },
        row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
        avatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: barBg,
        },
        textCol: { flex: 1, gap: 6 },
        barWide: {
            height: 12,
            borderRadius: 4,
            backgroundColor: barBg,
            width: '70%',
        },
        barMedium: {
            height: 10,
            borderRadius: 4,
            backgroundColor: barBg,
            width: '45%',
        },
        chipRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
        chip: {
            height: 22,
            borderRadius: 6,
            backgroundColor: barBg,
            width: 70,
        },
        barNarrow: {
            height: 10,
            borderRadius: 4,
            backgroundColor: barBg,
            width: '35%',
        },
    });
}

// ---------------------------------------------------------------------------
// Collapsible section for detail modal
// ---------------------------------------------------------------------------

function CollapsibleSection({
    title,
    count,
    colors,
    scheme,
    children,
}: {
    title: string;
    count: string;
    colors: AppThemeColors;
    scheme: 'light' | 'dark';
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const sty = useMemo(() => buildCollapsibleStyles(colors, scheme), [colors, scheme]);

    return (
        <View style={sty.wrap}>
            <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() => setOpen(prev => !prev)}
                style={({ pressed }) => [sty.header, pressed && sty.headerPressed]}>
                <View style={sty.headerLeft}>
                    <Text style={sty.headerTitle}>{title}</Text>
                    <Text style={sty.headerCount}>{count}</Text>
                </View>
                <MaterialCommunityIcons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textMuted}
                />
            </Pressable>
            {open ? <View style={sty.body}>{children}</View> : null}
        </View>
    );
}

function buildCollapsibleStyles(colors: AppThemeColors, _scheme: 'light' | 'dark') {
    return StyleSheet.create({
        wrap: {
            borderRadius: 10,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            overflow: 'hidden',
            marginBottom: 10,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: colors.surface,
        },
        headerPressed: { opacity: 0.8 },
        headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
        headerTitle: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
        },
        headerCount: {
            fontSize: 12,
            color: colors.textMuted,
        },
        body: {
            paddingHorizontal: 12,
            paddingBottom: 10,
            backgroundColor: colors.surface,
        },
    });
}

// ---------------------------------------------------------------------------
// Detail modal
// ---------------------------------------------------------------------------

function DetailModal({
    invite,
    visible,
    onClose,
    onAccept,
    onReject,
    processing,
    colors,
    scheme,
}: {
    invite: InviteRecord | null;
    visible: boolean;
    onClose: () => void;
    onAccept: (inv: InviteRecord) => void;
    onReject: (inv: InviteRecord) => void;
    processing: boolean;
    colors: AppThemeColors;
    scheme: 'light' | 'dark';
}) {
    const { t } = useTranslation();
    const sty = useMemo(() => buildDetailStyles(colors, scheme), [colors, scheme]);

    if (!invite) {
        return null;
    }

    const st = displayStatus(invite);
    const logo = resolveLogoUrl(invite.company.logo_url);
    const inviterPhoto = resolveLogoUrl(invite.invited_by.profile_picture);
    const actable = canAct(invite);

    const shiftStart = normalizeDuration(invite.shift_start, '--:--');
    const shiftEnd = normalizeDuration(invite.shift_end, '--:--');

    const infoRows: Array<{ label: string; value: string }> = [
        { label: t('home.onboarding.detail.designation'), value: formatDisplay(invite.designation) },
        {
            label: t('home.onboarding.detail.employmentType'),
            value: formatDisplay(invite.employment_type),
        },
        { label: t('home.onboarding.detail.salaryType'), value: formatDisplay(invite.salary_type) },
        {
            label: t('home.onboarding.detail.schedule'),
            value: t('home.onboarding.detail.shiftTime', { start: shiftStart, end: shiftEnd }),
        },
        {
            label: t('home.onboarding.detail.breakDuration'),
            value: formatDurationDisplay(invite.break_minutes),
        },
        {
            label: t('home.onboarding.detail.gracePeriod'),
            value: formatDurationDisplay(invite.grace_minutes),
        },
        {
            label: t('home.onboarding.detail.status'),
            value: t(`home.onboarding.status.${st.key}`),
        },
        { label: t('home.onboarding.detail.sentDate'), value: formatDate(invite.created_at) },
        { label: t('home.onboarding.detail.expiresAt'), value: formatDate(invite.expires_at) },
    ];

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            statusBarTranslucent
            onRequestClose={onClose}>
            <SafeAreaView style={sty.safe} edges={['top', 'left', 'right', 'bottom']}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={sty.sheetWrap} pointerEvents="box-none">
                    <View style={sty.sheet}>
                        <View style={sty.handle} />

                        <View style={sty.sheetHeader}>
                            <Text style={sty.sheetTitle}>{t('home.onboarding.detail.title')}</Text>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t('home.onboarding.detail.close')}
                                onPress={onClose}
                                hitSlop={12}>
                                <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
                            </Pressable>
                        </View>

                        <ScrollView
                            bounces={false}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={sty.scrollContent}>
                            {/* Company header */}
                            <View style={sty.companyHeader}>
                                {logo ? (
                                    <Image
                                        source={{ uri: logo }}
                                        style={sty.detailLogo}
                                        resizeMode="cover"
                                        accessibilityIgnoresInvertColors
                                    />
                                ) : (
                                    <View style={sty.detailLogoFallback}>
                                        <Text style={sty.detailLogoInitials}>
                                            {getInitials(invite.company.name)}
                                        </Text>
                                    </View>
                                )}
                                <View style={sty.companyTextCol}>
                                    <Text style={sty.companyName}>{invite.company.name}</Text>
                                    <Text style={sty.companyLocation}>
                                        {locationString(invite.company.city, invite.company.state)}
                                    </Text>
                                </View>
                            </View>

                            {/* Invited by */}
                            <View style={sty.sectionCard}>
                                <Text style={sty.sectionLabel}>
                                    {t('home.onboarding.detail.invitedBy')}
                                </Text>
                                <View style={sty.inviterRow}>
                                    {inviterPhoto ? (
                                        <Image
                                            source={{ uri: inviterPhoto }}
                                            style={sty.inviterAvatar}
                                            resizeMode="cover"
                                            accessibilityIgnoresInvertColors
                                        />
                                    ) : (
                                        <View style={sty.inviterAvatarFallback}>
                                            <Text style={sty.inviterAvatarText}>
                                                {getInitials(invite.invited_by.name)}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={sty.inviterTextCol}>
                                        <Text style={sty.inviterName}>{invite.invited_by.name}</Text>
                                        {invite.invited_by.email ? (
                                            <Text style={sty.inviterSub}>{invite.invited_by.email}</Text>
                                        ) : null}
                                        {invite.invited_by.phone ? (
                                            <Text style={sty.inviterSub}>{invite.invited_by.phone}</Text>
                                        ) : null}
                                    </View>
                                </View>
                            </View>

                            {/* Info grid */}
                            <View style={sty.sectionCard}>
                                {infoRows.map((row, idx) => (
                                    <View
                                        key={row.label}
                                        style={[sty.infoRow, idx > 0 && sty.infoRowBorder]}>
                                        <Text style={sty.infoLabel}>{row.label}</Text>
                                        <Text style={sty.infoValue}>{row.value}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Weekends */}
                            {invite.weekends.length > 0 ? (
                                <CollapsibleSection
                                    title={t('home.onboarding.detail.weekends')}
                                    count={t('home.onboarding.detail.weekendCount', {
                                        count: invite.weekends.length,
                                    })}
                                    colors={colors}
                                    scheme={scheme}>
                                    {invite.weekends.map(w => (
                                        <View key={w.day} style={sty.collapsibleItem}>
                                            <Text style={sty.collapsibleItemText}>
                                                {formatDisplay(w.day)}
                                            </Text>
                                            <Text style={sty.collapsibleItemSub}>
                                                {w.type === 'full'
                                                    ? t('home.onboarding.detail.full')
                                                    : w.type === 'half'
                                                        ? t('home.onboarding.detail.half')
                                                        : formatDisplay(w.type)}
                                            </Text>
                                        </View>
                                    ))}
                                </CollapsibleSection>
                            ) : null}

                            {/* Permissions */}
                            {invite.permissions.length > 0 ? (
                                <CollapsibleSection
                                    title={t('home.onboarding.detail.permissions')}
                                    count={t('home.onboarding.detail.permissionCount', {
                                        count: invite.permissions.length,
                                    })}
                                    colors={colors}
                                    scheme={scheme}>
                                    {invite.permissions.map(p => (
                                        <View key={p.id} style={sty.collapsibleItem}>
                                            <Text style={sty.collapsibleItemText}>
                                                {formatDisplay(p.name)}
                                            </Text>
                                        </View>
                                    ))}
                                </CollapsibleSection>
                            ) : null}

                            {/* Attendance methods */}
                            {invite.attendance_methods.length > 0 ? (
                                <CollapsibleSection
                                    title={t('home.onboarding.detail.attendanceMethods')}
                                    count={t('home.onboarding.detail.methodCount', {
                                        count: invite.attendance_methods.length,
                                    })}
                                    colors={colors}
                                    scheme={scheme}>
                                    {invite.attendance_methods.map(m => (
                                        <View key={m.method} style={sty.collapsibleItem}>
                                            <Text style={sty.collapsibleItemText}>
                                                {formatDisplay(m.method)}
                                            </Text>
                                            {m.is_auto ? (
                                                <Text style={sty.collapsibleItemSub}>
                                                    {t('home.onboarding.detail.auto')}
                                                </Text>
                                            ) : null}
                                        </View>
                                    ))}
                                </CollapsibleSection>
                            ) : null}
                        </ScrollView>

                        {/* Footer */}
                        <View style={sty.sheetFooter}>
                            <Pressable
                                accessibilityRole="button"
                                onPress={onClose}
                                style={({ pressed }) => [
                                    sty.footerBtn,
                                    sty.footerBtnSecondary,
                                    pressed && sty.footerBtnPressed,
                                ]}>
                                <Text style={sty.footerBtnSecondaryText}>
                                    {t('home.onboarding.detail.close')}
                                </Text>
                            </Pressable>
                            {actable ? (
                                <>
                                    <Pressable
                                        accessibilityRole="button"
                                        disabled={processing}
                                        onPress={() => onAccept(invite)}
                                        style={({ pressed }) => [
                                            sty.footerBtn,
                                            sty.footerBtnAccept,
                                            pressed && sty.footerBtnPressed,
                                            processing && sty.footerBtnDisabled,
                                        ]}>
                                        <Text style={sty.footerBtnWhiteText}>
                                            {t('home.onboarding.accept')}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        accessibilityRole="button"
                                        disabled={processing}
                                        onPress={() => onReject(invite)}
                                        style={({ pressed }) => [
                                            sty.footerBtn,
                                            sty.footerBtnReject,
                                            pressed && sty.footerBtnPressed,
                                            processing && sty.footerBtnDisabled,
                                        ]}>
                                        <Text style={sty.footerBtnWhiteText}>
                                            {t('home.onboarding.reject')}
                                        </Text>
                                    </Pressable>
                                </>
                            ) : null}
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

function buildDetailStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
    return StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: colors.overlay,
        },
        sheetWrap: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        sheet: {
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '90%',
            ...Platform.select({
                ios: {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: scheme === 'dark' ? 0.4 : 0.12,
                    shadowRadius: 16,
                },
                android: { elevation: 16 },
            }),
        },
        handle: {
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: 'center',
            marginTop: 10,
            marginBottom: 6,
        },
        sheetHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingBottom: 10,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        sheetTitle: {
            fontSize: 17,
            fontWeight: '700',
            color: colors.text,
        },
        scrollContent: {
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 8,
        },
        companyHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 14,
        },
        detailLogo: {
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.border,
        },
        detailLogoFallback: {
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        detailLogoInitials: {
            fontSize: 18,
            fontWeight: '700',
            color: '#fff',
        },
        companyTextCol: {
            flex: 1,
            minWidth: 0,
        },
        companyName: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 2,
        },
        companyLocation: {
            fontSize: 13,
            color: colors.textMuted,
        },
        sectionCard: {
            borderRadius: 10,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 12,
            marginBottom: 10,
        },
        sectionLabel: {
            fontSize: 12,
            fontWeight: '700',
            color: colors.primary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 8,
        },
        inviterRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        inviterAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.border,
        },
        inviterAvatarFallback: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: scheme === 'dark' ? '#374151' : '#e2e8f0',
            alignItems: 'center',
            justifyContent: 'center',
        },
        inviterAvatarText: {
            fontSize: 14,
            fontWeight: '700',
            color: scheme === 'dark' ? '#d1d5db' : '#475569',
        },
        inviterTextCol: {
            flex: 1,
            minWidth: 0,
        },
        inviterName: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        inviterSub: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 1,
        },
        infoRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingVertical: 7,
        },
        infoRowBorder: {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        infoLabel: {
            fontSize: 13,
            color: colors.textMuted,
            flex: 1,
        },
        infoValue: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
            flex: 1,
            textAlign: 'right',
        },
        collapsibleItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 5,
        },
        collapsibleItemText: {
            fontSize: 13,
            color: colors.text,
        },
        collapsibleItemSub: {
            fontSize: 12,
            color: colors.textMuted,
        },
        sheetFooter: {
            flexDirection: 'row',
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        footerBtn: {
            flex: 1,
            borderRadius: 10,
            paddingVertical: 11,
            alignItems: 'center',
            justifyContent: 'center',
        },
        footerBtnSecondary: {
            backgroundColor: colors.secondaryButton,
            borderWidth: 1,
            borderColor: colors.border,
        },
        footerBtnSecondaryText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        footerBtnAccept: {
            backgroundColor: '#16a34a',
        },
        footerBtnReject: {
            backgroundColor: colors.danger,
        },
        footerBtnWhiteText: {
            fontSize: 14,
            fontWeight: '600',
            color: '#fff',
        },
        footerBtnPressed: {
            opacity: 0.85,
        },
        footerBtnDisabled: {
            opacity: 0.5,
        },
    });
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export function OnboardingRequestScreen({ navigation }: Props): React.JSX.Element {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const styles = useMemo(() => buildStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    const { refreshProfileRole } = useAuth();

    const { props: statusAlertProps, presentSuccess, presentError } = useStatusAlert();
    const { props: confirmAlertProps, present: presentConfirm } = useConfirmAlert();

    // ---- State ----
    const [invites, setInvites] = useState<InviteRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [selectedInvite, setSelectedInvite] = useState<InviteRecord | null>(null);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // ---- Debounce search ----
    useEffect(() => {
        const id = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [search]);

    // ---- Fetch invites ----
    const fetchInvites = useCallback(
        async (p: number, isRefreshing = false) => {
            if (!isRefreshing) {
                setLoading(true);
            }
            setError(null);
            try {
                const res = await inviteApi.getMyInvites({
                    page: p,
                    limit: PAGE_LIMIT,
                    status: statusFilter !== 'all' ? statusFilter : undefined,
                    search: debouncedSearch || undefined,
                });

                const records = (res.data ?? []).map(r => ({
                    ...r,
                    break_minutes: normalizeDuration(r.break_minutes, '00:30'),
                    grace_minutes: normalizeDuration(r.grace_minutes, '00:15'),
                }));

                const currentPage = res.current_page ?? res.page ?? res.meta?.page ?? 1;
                const tp = res.last_page ?? res.total_pages ?? res.meta?.total_pages ?? 1;

                setInvites(records);
                setPage(currentPage);
                setTotalPages(tp);
            } catch (err) {
                setError(readApiError(err));
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [statusFilter, debouncedSearch],
    );

    useEffect(() => {
        fetchInvites(page).catch(() => { });
    }, [fetchInvites, page]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchInvites(page, true).catch(() => { });
    }, [fetchInvites, page]);

    // ---- Filter change ----
    const handleFilterChange = useCallback((key: string) => {
        setStatusFilter(key);
        setPage(1);
    }, []);

    // ---- Accept ----
    const handleAccept = useCallback(
        (invite: InviteRecord) => {
            presentConfirm({
                title: t('home.onboarding.acceptModal.title'),
                message: t('home.onboarding.acceptModal.message', {
                    company: invite.company.name,
                }),
                buttons: [
                    {
                        text: t('home.onboarding.acceptModal.cancel'),
                        variant: 'secondary',
                    },
                    {
                        text: t('home.onboarding.acceptModal.confirm'),
                        variant: 'primary',
                        closeOnPress: false,
                        onPress: () => {
                            setProcessingId(invite.invite_id);
                            inviteApi
                                .accept(invite.invite_token)
                                .then(() => {
                                    setSelectedInvite(null);
                                    setProcessingId(null);
                                    presentSuccess({
                                        title: t('home.onboarding.acceptModal.successTitle'),
                                        message: t('home.onboarding.acceptModal.successMessage', {
                                            company: invite.company.name,
                                        }),
                                    });
                                    refreshProfileRole({ silent: true }).catch(() => { });
                                    fetchInvites(page).catch(() => { });
                                })
                                .catch(err => {
                                    setProcessingId(null);
                                    presentError({
                                        title: t('home.onboarding.errorTitle'),
                                        message: readApiError(err),
                                    });
                                });
                        },
                    },
                ],
            });
        },
        [
            presentConfirm,
            presentSuccess,
            presentError,
            t,
            fetchInvites,
            page,
            refreshProfileRole,
        ],
    );

    // ---- Reject ----
    const handleReject = useCallback(
        (invite: InviteRecord) => {
            presentConfirm({
                title: t('home.onboarding.rejectModal.title'),
                message: t('home.onboarding.rejectModal.message', {
                    company: invite.company.name,
                }),
                buttons: [
                    {
                        text: t('home.onboarding.rejectModal.cancel'),
                        variant: 'secondary',
                    },
                    {
                        text: t('home.onboarding.rejectModal.confirm'),
                        variant: 'danger',
                        closeOnPress: false,
                        onPress: () => {
                            setProcessingId(invite.invite_id);
                            inviteApi
                                .reject(invite.invite_token)
                                .then(() => {
                                    setSelectedInvite(null);
                                    setProcessingId(null);
                                    presentSuccess({
                                        title: t('home.onboarding.rejectModal.successTitle'),
                                        message: t('home.onboarding.rejectModal.successMessage'),
                                    });
                                    refreshProfileRole({ silent: true }).catch(() => { });
                                    fetchInvites(page).catch(() => { });
                                })
                                .catch(err => {
                                    setProcessingId(null);
                                    presentError({
                                        title: t('home.onboarding.errorTitle'),
                                        message: readApiError(err),
                                    });
                                });
                        },
                    },
                ],
            });
        },
        [
            presentConfirm,
            presentSuccess,
            presentError,
            t,
            fetchInvites,
            page,
            refreshProfileRole,
        ],
    );

    // ---- Renderers ----

    const renderCard = useCallback(
        ({ item }: { item: InviteRecord }) => {
            const st = displayStatus(item);
            const sc = statusColor(st.key, resolvedScheme);
            const logo = resolveLogoUrl(item.company.logo_url);
            const actable = canAct(item);
            const isProcessing = processingId === item.invite_id;

            return (
                <View style={styles.card}>
                    {/* Top row: logo + company info */}
                    <View style={styles.cardTopRow}>
                        {logo ? (
                            <Image
                                source={{ uri: logo }}
                                style={styles.cardLogo}
                                resizeMode="cover"
                                accessibilityIgnoresInvertColors
                            />
                        ) : (
                            <View style={styles.cardLogoFallback}>
                                <Text style={styles.cardLogoInitials}>
                                    {getInitials(item.company.name)}
                                </Text>
                            </View>
                        )}
                        <View style={styles.cardTextCol}>
                            <Text style={styles.cardCompanyName} numberOfLines={1}>
                                {item.company.name}
                            </Text>
                            <Text style={styles.cardLocation} numberOfLines={1}>
                                {locationString(item.company.city, item.company.state)}
                            </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                            <Text style={[styles.statusBadgeText, { color: sc.fg }]}>
                                {t(`home.onboarding.status.${st.key}`)}
                            </Text>
                        </View>
                    </View>

                    {/* Chips */}
                    <View style={styles.chipRow}>
                        {item.designation ? (
                            <View style={styles.chipTag}>
                                <Text style={styles.chipTagText} numberOfLines={1}>
                                    {formatDisplay(item.designation)}
                                </Text>
                            </View>
                        ) : null}
                        {item.employment_type ? (
                            <View style={styles.chipTag}>
                                <Text style={styles.chipTagText} numberOfLines={1}>
                                    {formatDisplay(item.employment_type)}
                                </Text>
                            </View>
                        ) : null}
                        {item.salary_type ? (
                            <View style={styles.chipTag}>
                                <Text style={styles.chipTagText} numberOfLines={1}>
                                    {formatDisplay(item.salary_type)}
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    {/* Invited by + expiry */}
                    <View style={styles.cardMeta}>
                        <Text style={styles.cardMetaText} numberOfLines={1}>
                            {t('home.onboarding.invitedBy', { name: item.invited_by.name })}
                        </Text>
                        <Text
                            style={[
                                styles.cardMetaText,
                                isExpired(item.expires_at) && styles.cardMetaExpired,
                            ]}
                            numberOfLines={1}>
                            {isExpired(item.expires_at)
                                ? t('home.onboarding.expired', { date: formatDate(item.expires_at) })
                                : t('home.onboarding.expires', { date: formatDate(item.expires_at) })}
                        </Text>
                    </View>

                    {/* Actions */}
                    <View style={styles.cardActions}>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => setSelectedInvite(item)}
                            style={({ pressed }) => [
                                styles.actionBtn,
                                styles.actionBtnView,
                                pressed && styles.actionBtnPressed,
                            ]}>
                            <Text style={styles.actionBtnViewText}>
                                {t('home.onboarding.viewDetails')}
                            </Text>
                        </Pressable>
                        {actable ? (
                            <>
                                <Pressable
                                    accessibilityRole="button"
                                    disabled={isProcessing}
                                    onPress={() => handleAccept(item)}
                                    style={({ pressed }) => [
                                        styles.actionBtn,
                                        styles.actionBtnAccept,
                                        pressed && styles.actionBtnPressed,
                                        isProcessing && styles.actionBtnDisabled,
                                    ]}>
                                    {isProcessing ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.actionBtnWhiteText}>
                                            {t('home.onboarding.accept')}
                                        </Text>
                                    )}
                                </Pressable>
                                <Pressable
                                    accessibilityRole="button"
                                    disabled={isProcessing}
                                    onPress={() => handleReject(item)}
                                    style={({ pressed }) => [
                                        styles.actionBtn,
                                        styles.actionBtnReject,
                                        pressed && styles.actionBtnPressed,
                                        isProcessing && styles.actionBtnDisabled,
                                    ]}>
                                    <Text style={styles.actionBtnWhiteText}>
                                        {t('home.onboarding.reject')}
                                    </Text>
                                </Pressable>
                            </>
                        ) : null}
                    </View>
                </View>
            );
        },
        [styles, resolvedScheme, processingId, t, handleAccept, handleReject],
    );

    const keyExtractor = useCallback(
        (item: InviteRecord) => item.invite_id,
        [],
    );

    const emptyMessage = useMemo(() => {
        if (error) {
            return null;
        }
        if (debouncedSearch || statusFilter !== 'all') {
            return t('home.onboarding.noInvitesFiltered');
        }
        return t('home.onboarding.noInvitesYet');
    }, [error, debouncedSearch, statusFilter, t]);

    const listEmpty = useCallback(() => {
        if (loading) {
            return (
                <View style={styles.skeletonWrap}>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <SkeletonCard key={i} colors={colors} scheme={resolvedScheme} />
                    ))}
                </View>
            );
        }

        if (error) {
            return (
                <View style={styles.emptyWrap}>
                    <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={48}
                        color={colors.danger}
                    />
                    <Text style={styles.emptyTitle}>{t('home.onboarding.errorTitle')}</Text>
                    <Text style={styles.emptyText}>{error}</Text>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => fetchInvites(page).catch(() => { })}
                        style={({ pressed }) => [
                            styles.retryBtn,
                            pressed && styles.retryBtnPressed,
                        ]}>
                        <Text style={styles.retryBtnText}>{t('home.onboarding.retry')}</Text>
                    </Pressable>
                </View>
            );
        }

        return (
            <View style={styles.emptyWrap}>
                <MaterialCommunityIcons
                    name="email-open-outline"
                    size={56}
                    color={colors.textMuted}
                />
                <Text style={styles.emptyText}>{emptyMessage}</Text>
            </View>
        );
    }, [
        loading,
        error,
        colors,
        resolvedScheme,
        styles,
        t,
        emptyMessage,
        fetchInvites,
        page,
    ]);

    const listFooter = useCallback(() => {
        if (totalPages <= 1 || invites.length === 0) {
            return null;
        }
        return (
            <View style={styles.paginationRow}>
                <Pressable
                    accessibilityRole="button"
                    disabled={page <= 1}
                    onPress={() => setPage(p => Math.max(1, p - 1))}
                    style={({ pressed }) => [
                        styles.pageBtn,
                        (page <= 1 || pressed) && styles.pageBtnDisabled,
                    ]}>
                    <Text style={styles.pageBtnText}>{t('home.onboarding.prev')}</Text>
                </Pressable>
                <Text style={styles.pageInfo}>
                    {t('home.onboarding.page', { current: page, total: totalPages })}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    disabled={page >= totalPages}
                    onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                    style={({ pressed }) => [
                        styles.pageBtn,
                        (page >= totalPages || pressed) && styles.pageBtnDisabled,
                    ]}>
                    <Text style={styles.pageBtnText}>{t('home.onboarding.next')}</Text>
                </Pressable>
            </View>
        );
    }, [totalPages, invites.length, page, styles, t]);

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
            {/* Header */}
            <View style={styles.stackHeader}>
                <HeaderBackButton
                    onPress={() => navigation.goBack()}
                    tintColor={colors.primary}
                />
                <Text style={styles.stackHeaderTitle}>{t('home.onboarding.title')}</Text>
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
                <MaterialCommunityIcons
                    name="magnify"
                    size={18}
                    color={colors.textMuted}
                    style={styles.searchIcon}
                />
                <TextInput
                    style={styles.searchInput}
                    placeholder={t('home.onboarding.searchPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                />
                {search.length > 0 ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('home.onboarding.clearSearch')}
                        onPress={() => setSearch('')}
                        hitSlop={8}>
                        <MaterialCommunityIcons name="close-circle" size={16} color={colors.textMuted} />
                    </Pressable>
                ) : null}
            </View>

            {/* Filter chips */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterRow}
                keyboardShouldPersistTaps="handled">
                {STATUS_FILTERS.map(f => {
                    const active = statusFilter === f.key;
                    return (
                        <Pressable
                            key={f.key}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            onPress={() => handleFilterChange(f.key)}
                            style={[
                                styles.filterChip,
                                active && styles.filterChipActive,
                            ]}>
                            <Text
                                style={[
                                    styles.filterChipText,
                                    active && styles.filterChipTextActive,
                                ]}>
                                {t(f.labelKey)}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {/* List */}
            <FlatList
                style={styles.list}
                data={loading ? [] : invites}
                keyExtractor={keyExtractor}
                renderItem={renderCard}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={listEmpty}
                ListFooterComponent={listFooter}
                refreshing={refreshing}
                onRefresh={handleRefresh}
            />

            {/* Detail modal */}
            <DetailModal
                invite={selectedInvite}
                visible={selectedInvite !== null}
                onClose={() => setSelectedInvite(null)}
                onAccept={handleAccept}
                onReject={handleReject}
                processing={processingId !== null}
                colors={colors}
                scheme={resolvedScheme}
            />

            {/* Alert modals */}
            <StatusAlert {...statusAlertProps} />
            <ConfirmAlert {...confirmAlertProps} />
        </SafeAreaView>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
    return StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: colors.background,
        },

        // Header
        stackHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 48,
            paddingRight: 16,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
        },
        stackHeaderTitle: {
            fontSize: 17,
            fontWeight: '700',
            color: colors.text,
            flex: 1,
        },

        // Search
        searchWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: 14,
            marginTop: 10,
            marginBottom: 6,
            backgroundColor: colors.surface,
            borderRadius: 10,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            minHeight: 38,
            paddingHorizontal: 10,
        },
        searchIcon: {
            marginRight: 6,
        },
        searchInput: {
            flex: 1,
            fontSize: 14,
            color: colors.text,
            paddingVertical: Platform.OS === 'ios' ? 8 : 5,
        },

        // Filters
        filterScroll: {
            flexGrow: 0,
            marginBottom: 8,
        },
        filterRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 2,
            gap: 8,
        },
        filterChip: {
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 20,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignSelf: 'center',
        },
        filterChipActive: {
            backgroundColor: scheme === 'dark' ? 'rgba(99,102,241,0.2)' : '#eef2ff',
            borderColor: colors.primary,
        },
        filterChipText: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
            ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
        },
        filterChipTextActive: {
            color: colors.primary,
            fontWeight: '600',
        },

        // FlatList
        list: {
            flex: 1,
        },
        listContent: {
            paddingHorizontal: 14,
            paddingTop: 6,
            paddingBottom: 24,
            flexGrow: 1,
        },

        // Card
        card: {
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 12,
            marginBottom: 8,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            ...Platform.select({
                ios: {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: scheme === 'dark' ? 0.25 : 0.06,
                    shadowRadius: 4,
                },
                android: { elevation: 1 },
            }),
        },
        cardTopRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
        },
        cardLogo: {
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: colors.border,
        },
        cardLogoFallback: {
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        cardLogoInitials: {
            fontSize: 16,
            fontWeight: '700',
            color: '#fff',
        },
        cardTextCol: {
            flex: 1,
            minWidth: 0,
        },
        cardCompanyName: {
            fontSize: 15,
            fontWeight: '700',
            color: colors.text,
        },
        cardLocation: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 1,
        },
        statusBadge: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
        },
        statusBadgeText: {
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'capitalize',
        },
        chipRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 8,
        },
        chipTag: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.07)' : '#f1f5f9',
        },
        chipTagText: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.textMuted,
        },
        cardMeta: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        },
        cardMetaText: {
            fontSize: 12,
            color: colors.textMuted,
        },
        cardMetaExpired: {
            color: scheme === 'dark' ? '#f87171' : '#b91c1c',
        },
        cardActions: {
            flexDirection: 'row',
            gap: 6,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            paddingTop: 8,
        },
        actionBtn: {
            flex: 1,
            borderRadius: 8,
            paddingVertical: 8,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 34,
        },
        actionBtnView: {
            backgroundColor: colors.secondaryButton,
            borderWidth: 1,
            borderColor: colors.border,
        },
        actionBtnViewText: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
        },
        actionBtnAccept: {
            backgroundColor: '#16a34a',
        },
        actionBtnReject: {
            backgroundColor: colors.danger,
        },
        actionBtnWhiteText: {
            fontSize: 13,
            fontWeight: '600',
            color: '#fff',
        },
        actionBtnPressed: {
            opacity: 0.85,
        },
        actionBtnDisabled: {
            opacity: 0.5,
        },

        // Pagination
        paginationRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            paddingVertical: 12,
        },
        pageBtn: {
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 8,
            backgroundColor: colors.secondaryButton,
            borderWidth: 1,
            borderColor: colors.border,
        },
        pageBtnDisabled: {
            opacity: 0.45,
        },
        pageBtnText: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
        },
        pageInfo: {
            fontSize: 13,
            color: colors.textMuted,
            fontWeight: '500',
        },

        // Empty / error
        emptyWrap: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
            paddingTop: 60,
            gap: 12,
        },
        emptyTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
        },
        emptyText: {
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 20,
        },
        retryBtn: {
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: colors.primary,
            marginTop: 4,
        },
        retryBtnPressed: {
            opacity: 0.85,
        },
        retryBtnText: {
            fontSize: 14,
            fontWeight: '600',
            color: '#fff',
        },

        // Skeleton
        skeletonWrap: {
            gap: 8,
            paddingTop: 4,
        },
    });
}

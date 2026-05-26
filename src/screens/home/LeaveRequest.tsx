import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { leaveApi } from '@src/api/leaveApi';
import { fetchMyLeaveBalance } from '@src/api/fetchMyLeaveBalance';
import { ApplyLeaveModal } from '@src/components/modals/ApplyLeave';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { LeaveDetailModal } from '@src/components/modals/LeaveDetailModal';
import { StatusAlert, useStatusAlert } from '@src/components/modals/StatusAlert';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
    ApplyLeaveApiPayload,
    DerivedLeaveType,
    LeaveApplication,
    LeaveApplicationListMeta,
    LeaveApplicationStatus,
    UpdateLeaveApiPayload,
} from '@src/types/leaveApplication';
import type { LeaveBalanceEntry } from '@src/types/leaveBalance';
import { readApiError } from '@src/utils/readApiError';

type Props = NativeStackScreenProps<HomeStackParamList, 'LeaveRequest'>;

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;
const STATUS_FILTERS: Array<LeaveApplicationStatus | null> = [
    null, 'pending', 'approved', 'rejected', 'cancelled',
];

function humanizeLeaveKey(key: string): string {
    return key
        .split('_')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function formatShortDate(iso: string): string {
    const d = new Date(iso + 'T12:00:00');
    if (Number.isNaN(d.getTime())) {
        return iso;
    }
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return iso;
    }
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type StatusColor = { bg: string; text: string; border: string };

function statusColors(status: LeaveApplicationStatus, scheme: 'light' | 'dark'): StatusColor {
    switch (status) {
        case 'pending':
            return scheme === 'dark'
                ? { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', border: 'rgba(251,191,36,0.4)' }
                : { bg: '#fffbeb', text: '#b45309', border: '#fde68a' };
        case 'approved':
            return scheme === 'dark'
                ? { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.4)' }
                : { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' };
        case 'rejected':
            return scheme === 'dark'
                ? { bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.4)' }
                : { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' };
        case 'cancelled':
            return scheme === 'dark'
                ? { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', border: 'rgba(148,163,184,0.4)' }
                : { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' };
    }
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
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
            minHeight: 48,
            maxHeight: 48,
        },
        stackHeaderTitle: {
            flex: 1,
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            marginLeft: 2,
        },
        applyHeaderBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 10,
            backgroundColor: colors.primary,
        },
        applyHeaderLabel: {
            fontSize: 13,
            fontWeight: '700',
            color: '#fff',
        },
        listContent: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 100 },

        statsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
        statCard: {
            flex: 1,
            paddingVertical: 8,
            paddingHorizontal: 6,
            borderRadius: 10,
            borderWidth: 1,
            alignItems: 'center',
        },
        statLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
        statValue: { fontSize: 16, fontWeight: '800', marginTop: 2 },

        sectionTitle: {
            fontSize: 14,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 8,
            marginTop: 4,
        },

        balanceScroll: { marginBottom: 12 },
        balanceCard: {
            width: 200,
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
            marginRight: 10,
            ...Platform.select({
                ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: scheme === 'dark' ? 0.2 : 0.05, shadowRadius: 3 },
                android: { elevation: 1 },
            }),
        },
        balanceCardTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
        balanceCardCode: { fontSize: 11, fontWeight: '600', color: colors.primary, marginBottom: 6 },
        balanceBadgeRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginBottom: 8 },
        balanceBadge: {
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 5,
            backgroundColor: scheme === 'dark' ? '#334155' : colors.secondaryButton,
            borderWidth: 1,
            borderColor: colors.border,
        },
        balanceBadgeText: { fontSize: 9, fontWeight: '600', color: colors.textMuted },
        balanceRemaining: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
        balanceRemainingLow: { color: '#dc2626' },
        balanceRemainingOk: { color: colors.primary },
        progressTrack: {
            height: 6,
            borderRadius: 3,
            backgroundColor: scheme === 'dark' ? '#334155' : colors.secondaryButton,
            overflow: 'hidden',
            marginBottom: 4,
        },
        progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
        balanceFooter: { flexDirection: 'row', justifyContent: 'space-between' },
        balanceFooterText: { fontSize: 10, color: colors.textMuted },

        searchWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 10,
            marginBottom: 6,
            minHeight: 38,
        },
        searchIcon: { marginRight: 6 },
        searchInput: {
            flex: 1,
            paddingVertical: Platform.OS === 'ios' ? 8 : 5,
            fontSize: 14,
            color: colors.text,
        },
        searchClearBtn: { marginLeft: 4, padding: 4 },

        chipScroll: { marginBottom: 8 },
        statusChip: {
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            marginRight: 6,
        },
        statusChipActive: {
            borderColor: colors.primary,
            backgroundColor: scheme === 'dark' ? 'rgba(59,130,246,0.2)' : '#eff6ff',
        },
        statusChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
        statusChipTextActive: { color: colors.primary },

        leaveCard: {
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
            marginBottom: 8,
            ...Platform.select({
                ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: scheme === 'dark' ? 0.15 : 0.04, shadowRadius: 2 },
                android: { elevation: 1 },
            }),
        },
        leaveCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
        leaveTypeName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
        leaveStatusBadge: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            borderWidth: 1,
        },
        leaveStatusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
        leaveCardMid: { marginBottom: 6 },
        leaveDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
        leaveDateText: { fontSize: 12, color: colors.text, fontWeight: '500' },
        leaveMetaText: { fontSize: 11, color: colors.textMuted },
        leaveCardActions: {
            flexDirection: 'row',
            gap: 6,
            marginTop: 6,
            paddingTop: 6,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        leaveActionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 7,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        leaveActionText: { fontSize: 11, fontWeight: '600', color: colors.text },
        leaveActionDanger: { borderColor: '#fecaca', backgroundColor: scheme === 'dark' ? 'rgba(239,68,68,0.1)' : '#fef2f2' },
        leaveActionDangerText: { color: '#dc2626' },

        paginationRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            paddingVertical: 8,
        },
        paginationBtn: {
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        paginationBtnDisabled: { opacity: 0.35 },
        paginationBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
        paginationInfo: { fontSize: 12, color: colors.textMuted },

        centerBox: { paddingVertical: 30, alignItems: 'center', justifyContent: 'center', gap: 10 },
        muted: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
        error: { fontSize: 14, color: '#dc2626', textAlign: 'center', marginBottom: 12 },
        retryBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary },
        retryLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },

        cancelSheet: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            maxWidth: 400,
            alignSelf: 'center',
            width: '100%',
        },
        cancelTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 6 },
        cancelMessage: { fontSize: 14, color: colors.textMuted, marginBottom: 12, lineHeight: 20 },
        cancelInput: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'ios' ? 10 : 8,
            fontSize: 14,
            color: colors.text,
            backgroundColor: colors.background,
            marginBottom: 6,
            minHeight: 60,
            textAlignVertical: 'top',
        },
        cancelError: { fontSize: 12, color: '#dc2626', marginBottom: 8 },
        cancelActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
        cancelBtnSecondary: {
            flex: 1,
            paddingVertical: 11,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            backgroundColor: colors.background,
        },
        cancelBtnPrimary: {
            flex: 1,
            paddingVertical: 11,
            borderRadius: 10,
            alignItems: 'center',
            backgroundColor: '#dc2626',
        },
        cancelBtnSecondaryLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
        cancelBtnPrimaryLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },

        skeleton: {
            height: 80,
            borderRadius: 12,
            backgroundColor: scheme === 'dark' ? '#334155' : '#e2e8f0',
            marginBottom: 8,
            opacity: 0.6,
        },
    });
}

export function LeaveRequestScreen({ navigation }: Props) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const styles = useMemo(() => buildStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    const { selectedCompany } = useAuth();
    const companyId = selectedCompany?.id ?? null;

    const { props: statusAlertProps, presentError, presentSuccess } = useStatusAlert();
    const { props: confirmProps } = useConfirmAlert();

    const [balances, setBalances] = useState<[string, LeaveBalanceEntry][]>([]);
    const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
    const [meta, setMeta] = useState<LeaveApplicationListMeta | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [leavesLoading, setLeavesLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<LeaveApplicationStatus | null>(null);

    const [detailLeave, setDetailLeave] = useState<LeaveApplication | null>(null);
    const [applyVisible, setApplyVisible] = useState(false);
    const [editLeave, setEditLeave] = useState<LeaveApplication | null>(null);
    const [applySubmitting, setApplySubmitting] = useState(false);
    const [cancelTarget, setCancelTarget] = useState<LeaveApplication | null>(null);
    const [cancelRemarks, setCancelRemarks] = useState('');
    const [cancelError, setCancelError] = useState<string | null>(null);
    const [cancelSubmitting, setCancelSubmitting] = useState(false);

    const searchInputRef = useRef<TextInput>(null);
    const initialLoadDone = useRef(false);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [search]);

    const derivedLeaveTypes: DerivedLeaveType[] = useMemo(() => {
        return balances.map(([key, bal]) => ({
            id: String(bal.leave_config_id),
            name: bal.name || humanizeLeaveKey(key),
            code: bal.code || '',
            is_paid: bal.is_paid,
            allow_half_day: bal.allow_half_day,
            remaining: bal.remaining,
            total: bal.total,
            used: bal.used,
        }));
    }, [balances]);

    const loadBalances = useCallback(async () => {
        if (companyId == null) {
            return;
        }
        try {
            const res = await fetchMyLeaveBalance(companyId);
            if (res.success && res.data) {
                setBalances(Object.entries(res.data).sort(([a], [b]) => a.localeCompare(b)));
            }
        } catch {
            // balance errors are non-blocking
        }
    }, [companyId]);

    const loadLeaves = useCallback(async (p: number) => {
        if (companyId == null) {
            return;
        }
        setLeavesLoading(true);
        try {
            const res = await leaveApi.getMyApplications(companyId, { page: p, limit: PAGE_SIZE });
            if (res.success) {
                setLeaves(res.data ?? []);
                setMeta(res.meta ?? null);
            } else {
                setError(res.message ?? t('home.leaveRequest.apiError'));
            }
        } catch (e) {
            setError(readApiError(e));
        } finally {
            setLeavesLoading(false);
        }
    }, [companyId, t]);

    const loadAll = useCallback(async () => {
        if (companyId == null) {
            setLoading(false);
            return;
        }
        setError(null);
        setLoading(true);
        await Promise.all([loadBalances(), loadLeaves(1)]);
        setPage(1);
        setLoading(false);
    }, [companyId, loadBalances, loadLeaves]);

    useEffect(() => {
        if (initialLoadDone.current) {
            return;
        }
        initialLoadDone.current = true;
        loadAll().catch(() => {});
    }, [loadAll]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadAll();
        setRefreshing(false);
    }, [loadAll]);

    const goToPage = useCallback((p: number) => {
        setPage(p);
        loadLeaves(p).catch(() => {});
    }, [loadLeaves]);

    const filteredLeaves = useMemo(() => {
        let result = leaves;
        if (statusFilter) {
            result = result.filter(l => l.status === statusFilter);
        }
        if (debouncedSearch) {
            const q = debouncedSearch.toLowerCase();
            result = result.filter(l =>
                l.leave_type_name.toLowerCase().includes(q) ||
                l.reason.toLowerCase().includes(q),
            );
        }
        return result;
    }, [debouncedSearch, leaves, statusFilter]);

    const stats = useMemo(() => {
        const all = leaves;
        return {
            total: all.length,
            pending: all.filter(l => l.status === 'pending').length,
            approved: all.filter(l => l.status === 'approved').length,
            rejected: all.filter(l => l.status === 'rejected').length,
        };
    }, [leaves]);

    const openApply = useCallback(() => {
        setEditLeave(null);
        setApplyVisible(true);
    }, []);

    const openEdit = useCallback((leave: LeaveApplication) => {
        setEditLeave(leave);
        setApplyVisible(true);
    }, []);

    const closeApply = useCallback(() => {
        if (applySubmitting) {
            return;
        }
        setApplyVisible(false);
        setEditLeave(null);
    }, [applySubmitting]);

    const handleApplySubmit = useCallback(
        async (payload: ApplyLeaveApiPayload | UpdateLeaveApiPayload) => {
            if (companyId == null) {
                return;
            }
            setApplySubmitting(true);
            try {
                const isEdit = 'id' in payload;
                const res = isEdit
                    ? await leaveApi.update(companyId, payload as UpdateLeaveApiPayload)
                    : await leaveApi.apply(companyId, payload as ApplyLeaveApiPayload);
                if (!res.success) {
                    presentError({ title: t('home.leaveRequest.errorTitle'), message: res.message });
                    return;
                }
                setApplyVisible(false);
                setEditLeave(null);
                presentSuccess({
                    title: isEdit ? t('home.leaveRequest.editSuccessTitle') : t('home.leaveRequest.applySuccessTitle'),
                    message: isEdit ? t('home.leaveRequest.editSuccessMessage') : t('home.leaveRequest.applySuccessMessage'),
                });
                await Promise.all([
                    loadBalances(),
                    loadLeaves(isEdit ? page : 1),
                ]);
                if (!isEdit) {
                    setPage(1);
                }
            } catch (e) {
                presentError({ title: t('home.leaveRequest.errorTitle'), message: readApiError(e) });
            } finally {
                setApplySubmitting(false);
            }
        },
        [companyId, loadBalances, loadLeaves, page, presentError, presentSuccess, t],
    );

    const openCancel = useCallback((leave: LeaveApplication) => {
        setCancelTarget(leave);
        setCancelRemarks('');
        setCancelError(null);
        setCancelSubmitting(false);
    }, []);

    const closeCancel = useCallback(() => {
        if (cancelSubmitting) {
            return;
        }
        setCancelTarget(null);
    }, [cancelSubmitting]);

    const handleCancelSubmit = useCallback(async () => {
        if (companyId == null || cancelTarget == null) {
            return;
        }
        const remarks = cancelRemarks.trim();
        if (!remarks) {
            setCancelError(t('home.leaveRequest.cancelModal.remarksRequired'));
            return;
        }
        setCancelError(null);
        setCancelSubmitting(true);
        try {
            const res = await leaveApi.cancel(companyId, { id: cancelTarget.id, remarks });
            if (!res.success) {
                presentError({ title: t('home.leaveRequest.errorTitle'), message: res.message });
                return;
            }
            setCancelTarget(null);
            presentSuccess({
                title: t('home.leaveRequest.cancelSuccessTitle'),
                message: t('home.leaveRequest.cancelSuccessMessage'),
            });
            await Promise.all([loadBalances(), loadLeaves(page)]);
        } catch (e) {
            presentError({ title: t('home.leaveRequest.errorTitle'), message: readApiError(e) });
        } finally {
            setCancelSubmitting(false);
        }
    }, [cancelRemarks, cancelTarget, companyId, loadBalances, loadLeaves, page, presentError, presentSuccess, t]);

    const renderLeaveCard = useCallback(({ item }: { item: LeaveApplication }) => {
        const sc = statusColors(item.status, resolvedScheme);
        const isPending = item.status === 'pending';
        return (
            <View style={styles.leaveCard}>
                <View style={styles.leaveCardTop}>
                    <Text style={styles.leaveTypeName} numberOfLines={1}>{item.leave_type_name}</Text>
                    <View style={[styles.leaveStatusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
                        <Text style={[styles.leaveStatusText, { color: sc.text }]}>
                            {t(`home.leaveRequest.status.${item.status}`)}
                        </Text>
                    </View>
                </View>
                <View style={styles.leaveCardMid}>
                    <View style={styles.leaveDateRow}>
                        <MaterialCommunityIcons name="calendar-range" size={13} color={colors.textMuted} />
                        <Text style={styles.leaveDateText}>
                            {formatShortDate(item.start_date)} — {formatShortDate(item.end_date)}
                        </Text>
                        <Text style={styles.leaveMetaText}>
                            · {item.total_days}d{item.is_half_day ? ' (Half)' : ''}
                        </Text>
                    </View>
                    {item.reason ? (
                        <Text style={styles.leaveMetaText} numberOfLines={1}>{item.reason}</Text>
                    ) : null}
                    <Text style={styles.leaveMetaText}>
                        {t('home.leaveRequest.appliedOn', { date: formatDateTime(item.applied_at) })}
                    </Text>
                </View>
                <View style={styles.leaveCardActions}>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => setDetailLeave(item)}
                        style={({ pressed }) => [styles.leaveActionBtn, pressed && { opacity: 0.85 }]}>
                        <MaterialCommunityIcons name="eye-outline" size={13} color={styles.leaveActionText.color} />
                        <Text style={styles.leaveActionText}>{t('home.leaveRequest.viewDetails')}</Text>
                    </Pressable>
                    {isPending ? (
                        <>
                            <Pressable
                                accessibilityRole="button"
                                onPress={() => openEdit(item)}
                                style={({ pressed }) => [styles.leaveActionBtn, pressed && { opacity: 0.85 }]}>
                                <MaterialCommunityIcons name="pencil-outline" size={13} color={styles.leaveActionText.color} />
                                <Text style={styles.leaveActionText}>{t('home.leaveRequest.edit')}</Text>
                            </Pressable>
                            <Pressable
                                accessibilityRole="button"
                                onPress={() => openCancel(item)}
                                style={({ pressed }) => [styles.leaveActionBtn, styles.leaveActionDanger, pressed && { opacity: 0.85 }]}>
                                <MaterialCommunityIcons name="close-circle-outline" size={13} color="#dc2626" />
                                <Text style={[styles.leaveActionText, styles.leaveActionDangerText]}>{t('home.leaveRequest.cancelLeave')}</Text>
                            </Pressable>
                        </>
                    ) : null}
                </View>
            </View>
        );
    }, [colors.textMuted, openCancel, openEdit, resolvedScheme, styles, t]);

    const listHeader = useMemo(() => (
        <View>
            {!loading && leaves.length > 0 ? (
                <View style={styles.statsRow}>
                    {([
                        { key: 'total' as const, val: stats.total, color: colors.primary },
                        { key: 'pending' as const, val: stats.pending, color: resolvedScheme === 'dark' ? '#fbbf24' : '#b45309' },
                        { key: 'approved' as const, val: stats.approved, color: resolvedScheme === 'dark' ? '#4ade80' : '#15803d' },
                        { key: 'rejected' as const, val: stats.rejected, color: '#dc2626' },
                    ] as const).map(({ key, val, color }) => (
                        <View
                            key={key}
                            style={[styles.statCard, { borderColor: color + '33', backgroundColor: color + '0d' }]}>
                            <Text style={styles.statLabel}>{t(`home.leaveRequest.stats.${key}`)}</Text>
                            <Text style={[styles.statValue, { color }]}>{val}</Text>
                        </View>
                    ))}
                </View>
            ) : null}

            {balances.length > 0 ? (
                <>
                    <Text style={styles.sectionTitle}>{t('home.leaveRequest.balanceTitle')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.balanceScroll}>
                        {balances.map(([key, bal]) => {
                            const usedPct = bal.total > 0 ? Math.min(100, Math.round((bal.used / bal.total) * 100)) : 0;
                            return (
                                <View key={key} style={styles.balanceCard}>
                                    <Text style={styles.balanceCardTitle} numberOfLines={1}>{bal.name || humanizeLeaveKey(key)}</Text>
                                    <Text style={styles.balanceCardCode}>{bal.code}</Text>
                                    <View style={styles.balanceBadgeRow}>
                                        <View style={styles.balanceBadge}>
                                            <Text style={styles.balanceBadgeText}>{bal.is_paid ? t('home.leaveRequest.paid') : t('home.leaveRequest.unpaid')}</Text>
                                        </View>
                                        {bal.allow_half_day ? (
                                            <View style={styles.balanceBadge}>
                                                <Text style={styles.balanceBadgeText}>{t('home.leaveRequest.halfDay')}</Text>
                                            </View>
                                        ) : null}
                                        {bal.exclude_weekends ? (
                                            <View style={styles.balanceBadge}>
                                                <Text style={styles.balanceBadgeText}>{t('home.leaveRequest.weekends')}</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                    <Text style={[styles.balanceRemaining, bal.remaining <= 0 ? styles.balanceRemainingLow : styles.balanceRemainingOk]}>
                                        {bal.remaining}
                                    </Text>
                                    {bal.total > 0 ? (
                                        <View style={styles.progressTrack}>
                                            <View style={[styles.progressFill, { width: `${usedPct}%` }]} />
                                        </View>
                                    ) : null}
                                    <View style={styles.balanceFooter}>
                                        <Text style={styles.balanceFooterText}>{t('home.leaveRequest.used')}: {bal.used}</Text>
                                        <Text style={styles.balanceFooterText}>{t('home.leaveRequest.total')}: {bal.total}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                </>
            ) : null}

            {!loading ? (
                <>
                    <Text style={styles.sectionTitle}>{t('home.leaveRequest.applicationsTitle')}</Text>
                    <View style={styles.searchWrap}>
                        <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} style={styles.searchIcon} />
                        <TextInput
                            ref={searchInputRef}
                            value={search}
                            onChangeText={setSearch}
                            placeholder={t('home.leaveRequest.searchPlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={styles.searchInput}
                            returnKeyType="search"
                        />
                        {search.length > 0 ? (
                            <Pressable
                                accessibilityRole="button"
                                onPress={() => { setSearch(''); searchInputRef.current?.focus(); }}
                                hitSlop={8}
                                style={({ pressed }) => [styles.searchClearBtn, pressed && { opacity: 0.7 }]}>
                                <MaterialCommunityIcons name="close-circle" size={20} color={colors.textMuted} />
                            </Pressable>
                        ) : null}
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                        {STATUS_FILTERS.map(s => {
                            const active = statusFilter === s;
                            const label = s == null
                                ? t('home.leaveRequest.filterAll')
                                : t(`home.leaveRequest.status.${s}`);
                            return (
                                <Pressable
                                    key={s ?? 'all'}
                                    accessibilityRole="button"
                                    onPress={() => setStatusFilter(s)}
                                    style={({ pressed }) => [
                                        styles.statusChip,
                                        active && styles.statusChipActive,
                                        pressed && { opacity: 0.9 },
                                    ]}>
                                    <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>{label}</Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </>
            ) : null}
        </View>
    ), [balances, colors.primary, colors.textMuted, leaves.length, loading, resolvedScheme, search, statusFilter, stats, styles, t]);

    const listFooter = useMemo(() => {
        if (leavesLoading && !loading) {
            return (
                <View style={styles.centerBox}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            );
        }
        if (meta && meta.total_pages > 1) {
            return (
                <View style={styles.paginationRow}>
                    <Pressable
                        accessibilityRole="button"
                        disabled={page <= 1}
                        onPress={() => goToPage(page - 1)}
                        style={({ pressed }) => [styles.paginationBtn, page <= 1 && styles.paginationBtnDisabled, pressed && { opacity: 0.85 }]}>
                        <Text style={styles.paginationBtnText}>{t('home.leaveRequest.prev')}</Text>
                    </Pressable>
                    <Text style={styles.paginationInfo}>
                        {t('home.leaveRequest.page', { current: page, total: meta.total_pages })}
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        disabled={page >= meta.total_pages}
                        onPress={() => goToPage(page + 1)}
                        style={({ pressed }) => [styles.paginationBtn, page >= meta.total_pages && styles.paginationBtnDisabled, pressed && { opacity: 0.85 }]}>
                        <Text style={styles.paginationBtnText}>{t('home.leaveRequest.next')}</Text>
                    </Pressable>
                </View>
            );
        }
        return null;
    }, [colors.primary, goToPage, leavesLoading, loading, meta, page, styles, t]);

    const listEmpty = useMemo(() => {
        if (loading) {
            return (
                <>
                    <View style={styles.skeleton} />
                    <View style={styles.skeleton} />
                    <View style={styles.skeleton} />
                </>
            );
        }
        if (error) {
            return (
                <View style={styles.centerBox}>
                    <Text style={styles.error}>{error}</Text>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => { loadAll().catch(() => {}); }}
                        style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}>
                        <Text style={styles.retryLabel}>{t('home.leaveRequest.retry')}</Text>
                    </Pressable>
                </View>
            );
        }
        if (filteredLeaves.length === 0 && (debouncedSearch || statusFilter)) {
            return (
                <View style={styles.centerBox}>
                    <Text style={styles.muted}>{t('home.leaveRequest.emptyFiltered')}</Text>
                </View>
            );
        }
        if (leaves.length === 0) {
            return (
                <View style={styles.centerBox}>
                    <Text style={styles.muted}>{t('home.leaveRequest.emptyApplications')}</Text>
                </View>
            );
        }
        return null;
    }, [debouncedSearch, error, filteredLeaves.length, leaves.length, loading, loadAll, statusFilter, styles, t]);

    if (companyId == null) {
        return (
            <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
                <View style={styles.stackHeader}>
                    <HeaderBackButton onPress={() => navigation.goBack()} tintColor={colors.primary} displayMode="minimal" />
                    <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
                        {t('home.leaveRequest.title')}
                    </Text>
                </View>
                <View style={[styles.centerBox, styles.fill]}>
                    <Text style={styles.muted}>{t('home.leaveRequest.noCompany')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
            <View style={styles.stackHeader}>
                <HeaderBackButton onPress={() => navigation.goBack()} tintColor={colors.primary} displayMode="minimal" />
                <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
                    {t('home.leaveRequest.title')}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    onPress={openApply}
                    style={({ pressed }) => [styles.applyHeaderBtn, pressed && { opacity: 0.9 }]}>
                    <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                    <Text style={styles.applyHeaderLabel}>{t('home.leaveRequest.apply')}</Text>
                </Pressable>
            </View>

            <FlatList
                style={styles.fill}
                data={loading ? [] : filteredLeaves}
                keyExtractor={item => item.id}
                renderItem={renderLeaveCard}
                ListHeaderComponent={listHeader}
                ListFooterComponent={listFooter}
                ListEmptyComponent={listEmpty}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            />

            <LeaveDetailModal
                visible={detailLeave != null}
                leave={detailLeave}
                onDismiss={() => setDetailLeave(null)}
            />
            <ApplyLeaveModal
                visible={applyVisible}
                onDismiss={closeApply}
                leaveTypes={derivedLeaveTypes}
                initialLeave={editLeave}
                onSubmit={handleApplySubmit}
                submitting={applySubmitting}
            />

            {cancelTarget != null ? (
                <ConfirmAlert
                    visible
                    onDismiss={closeCancel}
                    showTitle
                    showMessage={false}
                    title={t('home.leaveRequest.cancelModal.title')}
                    childrenPlacement="belowMessage"
                    buttons={[
                        { text: t('home.leaveRequest.cancelModal.dismiss'), variant: 'secondary', onPress: closeCancel },
                        {
                            text: cancelSubmitting ? t('home.leaveRequest.loading') : t('home.leaveRequest.cancelModal.confirm'),
                            variant: 'danger',
                            onPress: handleCancelSubmit,
                        },
                    ]}>
                    <View>
                        <Text style={styles.cancelMessage}>{t('home.leaveRequest.cancelModal.message')}</Text>
                        <TextInput
                            value={cancelRemarks}
                            onChangeText={setCancelRemarks}
                            placeholder={t('home.leaveRequest.cancelModal.remarksPlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            multiline
                            style={styles.cancelInput}
                        />
                        {cancelError ? <Text style={styles.cancelError}>{cancelError}</Text> : null}
                    </View>
                </ConfirmAlert>
            ) : null}

            <StatusAlert {...statusAlertProps} />
            <ConfirmAlert {...confirmProps} />
        </SafeAreaView>
    );
}

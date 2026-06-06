import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { LeaveConfigFormModal } from '@src/components/modals/LeaveConfigFormModal';
import { StatusAlert, useStatusAlert } from '@src/components/modals/StatusAlert';
import {
    TAB_SCREEN_SAFE_AREA_EDGES,
    TAB_SCREEN_SCROLL_PADDING_BOTTOM,
} from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useLeaveConfigs } from '@src/hooks/useLeaveConfigs';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
    CompanyLeaveConfig,
    CreateLeaveConfigPayload,
    UpdateLeaveConfigPayload,
} from '@src/types/leaveConfig';
import { formatLeaveDays } from '@src/utils/formatLeaveDays';
import { readApiError } from '@src/utils/readApiError';

const ACTION_T = 'home.leaveConfig.actions.';

type Props = NativeStackScreenProps<HomeStackParamList, 'LeaveConfig'>;

const SEARCH_DEBOUNCE_MS = 400;

const ACCENT_COLORS = [
    { accent: '#6366f1', soft: '#eef2ff', border: '#c7d2fe' },
    { accent: '#0ea5e9', soft: '#f0f9ff', border: '#bae6fd' },
    { accent: '#10b981', soft: '#ecfdf5', border: '#a7f3d0' },
    { accent: '#8b5cf6', soft: '#f5f3ff', border: '#ddd6fe' },
    { accent: '#f59e0b', soft: '#fffbeb', border: '#fde68a' },
    { accent: '#ec4899', soft: '#fdf2f8', border: '#fbcfe8' },
] as const;

type ConfigAccent = {
  accent: string;
  soft: string;
  border: string;
};

function getAccent(index: number, scheme: 'light' | 'dark'): ConfigAccent {
    const base = ACCENT_COLORS[index % ACCENT_COLORS.length];
    if (scheme === 'light') {
        return base;
    }
    return {
        accent: base.accent,
        soft: `${base.accent}22`,
        border: `${base.accent}44`,
    };
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
    const isDark = scheme === 'dark';
    const screenBg = isDark ? colors.background : '#f5f3ff';
    const cardBg = isDark ? colors.surface : '#ffffff';

    return StyleSheet.create({
        safe: { flex: 1, backgroundColor: screenBg },
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
        headerCreateBtn: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#7c3aed',
        },
        headerCreateBtnPressed: { opacity: 0.88 },
        headerCreateBtnDisabled: { opacity: 0.4 },
        filtersWrap: {
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 6,
            backgroundColor: screenBg,
        },
        searchWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: cardBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isDark ? colors.border : '#ddd6fe',
            paddingHorizontal: 12,
            marginBottom: 10,
            minHeight: 44,
        },
        searchIcon: { marginRight: 6 },
        searchInput: {
            flex: 1,
            paddingVertical: Platform.OS === 'ios' ? 10 : 7,
            fontSize: 14,
            color: colors.text,
        },
        searchClearBtn: { marginLeft: 4, padding: 4 },
        chipScroll: { marginBottom: 8 },
        chipScrollContent: { gap: 8, paddingRight: 8 },
        chip: {
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: isDark ? colors.border : '#e0e7ff',
            backgroundColor: cardBg,
        },
        chipActive: {
            borderColor: '#7c3aed',
            backgroundColor: isDark ? 'rgba(124,58,237,0.2)' : '#ede9fe',
        },
        chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
        chipTextActive: { color: isDark ? '#c4b5fd' : '#6d28d9' },
        totalBadge: {
            alignSelf: 'flex-start',
            marginBottom: 10,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: isDark ? 'rgba(124,58,237,0.2)' : '#ede9fe',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(167,139,250,0.35)' : '#ddd6fe',
        },
        totalBadgeText: { fontSize: 12, fontWeight: '700', color: isDark ? '#c4b5fd' : '#6d28d9' },
        listContent: {
            paddingHorizontal: 16,
            paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
        },
        configCard: {
            borderRadius: 14,
            borderWidth: 1,
            padding: 14,
            marginBottom: 12,
            gap: 10,
        },
        cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
        cardActions: { flexDirection: 'row', gap: 4 },
        rowActionBtn: {
            width: 30,
            height: 30,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        },
        codeBadge: {
            minWidth: 44,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
        },
        codeText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
        cardMain: { flex: 1, minWidth: 0 },
        configName: { fontSize: 16, fontWeight: '800', color: colors.text },
        statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
        statusActive: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#d1fae5',
        },
        statusInactive: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: isDark ? 'rgba(148,163,184,0.2)' : '#f1f5f9',
        },
        statusActiveText: { fontSize: 10, fontWeight: '700', color: isDark ? '#6ee7b7' : '#047857' },
        statusInactiveText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
        traitPaid: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#dbeafe',
        },
        traitUnpaid: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: isDark ? 'rgba(245,158,11,0.2)' : '#fef3c7',
        },
        traitHalf: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: isDark ? 'rgba(14,165,233,0.2)' : '#e0f2fe',
        },
        traitWeekend: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: isDark ? 'rgba(168,85,247,0.2)' : '#f3e8ff',
        },
        traitTextPaid: { fontSize: 10, fontWeight: '700', color: isDark ? '#93c5fd' : '#1d4ed8' },
        traitTextUnpaid: { fontSize: 10, fontWeight: '700', color: isDark ? '#fcd34d' : '#b45309' },
        traitTextHalf: { fontSize: 10, fontWeight: '700', color: isDark ? '#7dd3fc' : '#0369a1' },
        traitTextWeekend: { fontSize: 10, fontWeight: '700', color: isDark ? '#d8b4fe' : '#7e22ce' },
        limitsRow: { flexDirection: 'row', gap: 8 },
        limitBox: {
            flex: 1,
            borderRadius: 10,
            paddingVertical: 10,
            paddingHorizontal: 8,
            alignItems: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        },
        limitLabel: { fontSize: 9, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
        limitValue: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 4 },
        paginationRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            paddingVertical: 12,
        },
        paginationBtn: {
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: cardBg,
        },
        paginationBtnDisabled: { opacity: 0.35 },
        paginationBtnText: { fontSize: 12, fontWeight: '600', color: '#7c3aed' },
        paginationInfo: { fontSize: 12, color: colors.textMuted },
        centerBox: {
            paddingVertical: 40,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            paddingHorizontal: 24,
        },
        muted: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
        error: { fontSize: 14, color: colors.danger, textAlign: 'center', marginBottom: 12 },
        retryBtn: {
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: '#7c3aed',
        },
        retryLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
        skeleton: {
            height: 120,
            borderRadius: 14,
            backgroundColor: isDark ? '#334155' : '#e2e8f0',
            marginBottom: 12,
            opacity: 0.6,
        },
        loadingOverlay: { position: 'absolute', top: 120, alignSelf: 'center' },
    });
}

type RowStyles = ReturnType<typeof buildStyles>;

type ConfigCardProps = {
    item: CompanyLeaveConfig;
    index: number;
    styles: RowStyles;
    scheme: 'light' | 'dark';
    colors: AppThemeColors;
    t: (key: string, opts?: Record<string, unknown>) => string;
    canMutate: boolean;
    onEdit: () => void;
    onDelete: () => void;
};

const ConfigCard = React.memo(function ConfigCard({
    item,
    index,
    styles,
    scheme,
    colors,
    t,
    canMutate,
    onEdit,
    onDelete,
}: ConfigCardProps) {
    const accent = getAccent(index, scheme);
    const maxLabel =
        item.max_balance != null
            ? formatLeaveDays(item.max_balance)
            : t('home.leaveConfig.noLimit');

    return (
        <View
            style={[
                styles.configCard,
                { backgroundColor: accent.soft, borderColor: accent.border },
            ]}>
            <View style={styles.cardTop}>
                <View style={[styles.codeBadge, { backgroundColor: `${accent.accent}22` }]}>
                    <Text style={[styles.codeText, { color: accent.accent }]}>{item.code}</Text>
                </View>
                <View style={styles.cardMain}>
                    <Text style={styles.configName} numberOfLines={2}>{item.name}</Text>
                    <View style={styles.statusRow}>
                        <View style={item.is_active ? styles.statusActive : styles.statusInactive}>
                            <Text
                                style={item.is_active ? styles.statusActiveText : styles.statusInactiveText}>
                                {item.is_active
                                    ? t('home.leaveConfig.active')
                                    : t('home.leaveConfig.inactive')}
                            </Text>
                        </View>
                        <View style={item.is_paid ? styles.traitPaid : styles.traitUnpaid}>
                            <Text style={item.is_paid ? styles.traitTextPaid : styles.traitTextUnpaid}>
                                {item.is_paid ? t('home.leaveConfig.paid') : t('home.leaveConfig.unpaid')}
                            </Text>
                        </View>
                        {item.allow_half_day ? (
                            <View style={styles.traitHalf}>
                                <Text style={styles.traitTextHalf}>{t('home.leaveConfig.halfDay')}</Text>
                            </View>
                        ) : null}
                        {item.exclude_weekends ? (
                            <View style={styles.traitWeekend}>
                                <Text style={styles.traitTextWeekend}>
                                    {t('home.leaveConfig.excludeWeekends')}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>
                {canMutate ? (
                    <View style={styles.cardActions}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('home.leaveConfig.editType')}
                            onPress={onEdit}
                            style={styles.rowActionBtn}>
                            <MaterialCommunityIcons name="pencil-outline" size={16} color={accent.accent} />
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('home.leaveConfig.deleteType')}
                            onPress={onDelete}
                            style={styles.rowActionBtn}>
                            <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.danger} />
                        </Pressable>
                    </View>
                ) : null}
            </View>
            <View style={styles.limitsRow}>
                <View style={styles.limitBox}>
                    <Text style={styles.limitLabel}>{t('home.leaveConfig.maxBalance')}</Text>
                    <Text style={styles.limitValue}>{maxLabel}</Text>
                </View>
                <View style={styles.limitBox}>
                    <Text style={styles.limitLabel}>{t('home.leaveConfig.carryForward')}</Text>
                    <Text style={styles.limitValue}>{formatLeaveDays(item.carry_forward_limit)}</Text>
                </View>
            </View>
        </View>
    );
});

type ActiveFilter = 'all' | 'active' | 'inactive';
type PaidFilter = 'all' | 'paid' | 'unpaid';

export function LeaveConfigScreen({ navigation }: Props) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const styles = useMemo(
        () => buildStyles(colors, resolvedScheme),
        [colors, resolvedScheme],
    );
    const { selectedCompany } = useAuth();
    const companyId = selectedCompany?.id ?? null;
    const { props: statusAlertProps, presentError, presentSuccess } = useStatusAlert();
    const { props: confirmProps, present: presentConfirm } = useConfirmAlert();

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
    const [paidFilter, setPaidFilter] = useState<PaidFilter>('all');
    const [formModalVisible, setFormModalVisible] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [editConfig, setEditConfig] = useState<CompanyLeaveConfig | null>(null);
    const [mutationSubmitting, setMutationSubmitting] = useState(false);
    const pendingCreateRef = useRef<CreateLeaveConfigPayload | null>(null);
    const pendingUpdateRef = useRef<UpdateLeaveConfigPayload | null>(null);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, activeFilter, paidFilter]);

    const isActiveParam =
        activeFilter === 'all' ? null : activeFilter === 'active';
    const isPaidParam = paidFilter === 'all' ? null : paidFilter === 'paid';

    const {
        configs,
        meta,
        loading,
        refreshing,
        error,
        accessDenied,
        refresh,
        retry,
    } = useLeaveConfigs({
        companyId,
        page,
        search: debouncedSearch,
        isActive: isActiveParam,
        isPaid: isPaidParam,
    });

    const canGoPrev = (meta?.page ?? 1) > 1;
    const canGoNext = meta != null && meta.page < meta.total_pages;
    const canMutate = companyId != null && !accessDenied;

    const openCreateModal = useCallback(() => {
        if (companyId == null) {
            presentError({
                title: t(`${ACTION_T}errorTitle`),
                message: t('home.leaveConfig.noCompany'),
            });
            return;
        }
        setFormMode('create');
        setEditConfig(null);
        setFormModalVisible(true);
    }, [companyId, presentError, t]);

    const openEditModal = useCallback((config: CompanyLeaveConfig) => {
        setFormMode('edit');
        setEditConfig(config);
        setFormModalVisible(true);
    }, []);

    const closeFormModal = useCallback(() => {
        if (!mutationSubmitting) {
            setFormModalVisible(false);
            setEditConfig(null);
        }
    }, [mutationSubmitting]);

    const submitCreate = useCallback(
        async (payload: CreateLeaveConfigPayload) => {
            if (companyId == null) {
                return;
            }
            setMutationSubmitting(true);
            try {
                const res = await leaveApi.createLeaveConfig(companyId, payload);
                if (!res.success) {
                    throw new Error(res.message?.trim() || t(`${ACTION_T}errorTitle`));
                }
                setFormModalVisible(false);
                presentSuccess({
                    title: t(`${ACTION_T}createSuccessTitle`),
                    message: res.message?.trim() || t(`${ACTION_T}createSuccessTitle`),
                });
                refresh();
            } catch (e) {
                presentError({
                    title: t(`${ACTION_T}errorTitle`),
                    message: readApiError(e),
                });
            } finally {
                setMutationSubmitting(false);
                pendingCreateRef.current = null;
            }
        },
        [companyId, presentError, presentSuccess, refresh, t],
    );

    const handleCreateSubmit = useCallback(
        (payload: CreateLeaveConfigPayload) => {
            pendingCreateRef.current = payload;
            presentConfirm({
                title: t(`${ACTION_T}confirmCreateTitle`),
                message: t(`${ACTION_T}confirmCreateMessage`, {
                    name: payload.name,
                    code: payload.code.toUpperCase(),
                }),
                buttons: [
                    { text: t(`${ACTION_T}cancel`), variant: 'secondary' },
                    {
                        text: t(`${ACTION_T}confirm`),
                        variant: 'primary',
                        onPress: () => {
                            const pending = pendingCreateRef.current;
                            if (pending) {
                                submitCreate(pending).catch(() => {});
                            }
                        },
                    },
                ],
            });
        },
        [presentConfirm, submitCreate, t],
    );

    const submitUpdate = useCallback(
        async (payload: UpdateLeaveConfigPayload) => {
            if (companyId == null) {
                return;
            }
            setMutationSubmitting(true);
            try {
                const res = await leaveApi.updateLeaveConfig(companyId, payload);
                if (!res.success) {
                    throw new Error(res.message?.trim() || t(`${ACTION_T}errorTitle`));
                }
                setFormModalVisible(false);
                setEditConfig(null);
                presentSuccess({
                    title: t(`${ACTION_T}updateSuccessTitle`),
                    message: res.message?.trim() || t(`${ACTION_T}updateSuccessTitle`),
                });
                refresh();
            } catch (e) {
                presentError({
                    title: t(`${ACTION_T}errorTitle`),
                    message: readApiError(e),
                });
            } finally {
                setMutationSubmitting(false);
                pendingUpdateRef.current = null;
            }
        },
        [companyId, presentError, presentSuccess, refresh, t],
    );

    const handleUpdateSubmit = useCallback(
        (payload: UpdateLeaveConfigPayload) => {
            const configName = editConfig?.name ?? '';
            pendingUpdateRef.current = payload;
            presentConfirm({
                title: t(`${ACTION_T}confirmUpdateTitle`),
                message: t(`${ACTION_T}confirmUpdateMessage`, { name: configName }),
                buttons: [
                    { text: t(`${ACTION_T}cancel`), variant: 'secondary' },
                    {
                        text: t(`${ACTION_T}confirm`),
                        variant: 'primary',
                        onPress: () => {
                            const pending = pendingUpdateRef.current;
                            if (pending) {
                                submitUpdate(pending).catch(() => {});
                            }
                        },
                    },
                ],
            });
        },
        [editConfig?.name, presentConfirm, submitUpdate, t],
    );

    const submitDelete = useCallback(
        async (config: CompanyLeaveConfig) => {
            if (companyId == null) {
                return;
            }
            setMutationSubmitting(true);
            try {
                const res = await leaveApi.deleteLeaveConfig(companyId, { id: config.id });
                if (!res.success) {
                    throw new Error(res.message?.trim() || t(`${ACTION_T}errorTitle`));
                }
                presentSuccess({
                    title: t(`${ACTION_T}deleteSuccessTitle`),
                    message: res.message?.trim() || t(`${ACTION_T}deleteSuccessTitle`),
                });
                refresh();
            } catch (e) {
                presentError({
                    title: t(`${ACTION_T}errorTitle`),
                    message: readApiError(e),
                });
            } finally {
                setMutationSubmitting(false);
            }
        },
        [companyId, presentError, presentSuccess, refresh, t],
    );

    const handleDelete = useCallback(
        (config: CompanyLeaveConfig) => {
            presentConfirm({
                title: t(`${ACTION_T}confirmDeleteTitle`),
                message: t(`${ACTION_T}confirmDeleteMessage`, {
                    name: config.name,
                    code: config.code,
                }),
                buttons: [
                    { text: t(`${ACTION_T}cancel`), variant: 'secondary' },
                    {
                        text: t(`${ACTION_T}confirm`),
                        variant: 'danger',
                        onPress: () => {
                            submitDelete(config).catch(() => {});
                        },
                    },
                ],
            });
        },
        [presentConfirm, submitDelete, t],
    );

    const renderItem = useCallback(
        ({ item, index }: { item: CompanyLeaveConfig; index: number }) => (
            <ConfigCard
                item={item}
                index={index}
                styles={styles}
                scheme={resolvedScheme}
                colors={colors}
                t={t}
                canMutate={canMutate}
                onEdit={() => openEditModal(item)}
                onDelete={() => handleDelete(item)}
            />
        ),
        [canMutate, colors, handleDelete, openEditModal, resolvedScheme, styles, t],
    );

    const keyExtractor = useCallback((item: CompanyLeaveConfig) => String(item.id), []);

    const listHeader = useMemo(() => {
        if (meta?.total != null) {
            return (
                <View style={styles.totalBadge}>
                    <Text style={styles.totalBadgeText}>
                        {t('home.leaveConfig.totalTypes', { count: meta.total })}
                    </Text>
                </View>
            );
        }
        return null;
    }, [meta?.total, styles, t]);

    const listFooter = useMemo(() => {
        if (meta == null || meta.total_pages <= 1) {
            return null;
        }
        return (
            <View style={styles.paginationRow}>
                <Pressable
                    accessibilityRole="button"
                    disabled={!canGoPrev}
                    onPress={() => setPage(p => Math.max(1, p - 1))}
                    style={[styles.paginationBtn, !canGoPrev && styles.paginationBtnDisabled]}>
                    <Text style={styles.paginationBtnText}>{t('home.leaveConfig.prevPage')}</Text>
                </Pressable>
                <Text style={styles.paginationInfo}>
                    {t('home.leaveConfig.pageInfo', { page: meta.page, total: meta.total_pages })}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    disabled={!canGoNext}
                    onPress={() => setPage(p => p + 1)}
                    style={[styles.paginationBtn, !canGoNext && styles.paginationBtnDisabled]}>
                    <Text style={styles.paginationBtnText}>{t('home.leaveConfig.nextPage')}</Text>
                </Pressable>
            </View>
        );
    }, [canGoNext, canGoPrev, meta, styles, t]);

    const listEmpty = useMemo(() => {
        if (loading && configs.length === 0) {
            return (
                <View>
                    <View style={styles.skeleton} />
                    <View style={styles.skeleton} />
                    <View style={styles.skeleton} />
                </View>
            );
        }
        if (companyId == null) {
            return (
                <View style={styles.centerBox}>
                    <Text style={styles.muted}>{t('home.leaveConfig.noCompany')}</Text>
                </View>
            );
        }
        if (accessDenied) {
            return (
                <View style={styles.centerBox}>
                    <MaterialCommunityIcons name="shield-lock-outline" size={40} color={colors.textMuted} />
                    <Text style={styles.muted}>{t('home.leaveConfig.accessDenied')}</Text>
                </View>
            );
        }
        if (error != null) {
            return (
                <View style={styles.centerBox}>
                    <Text style={styles.error}>{error}</Text>
                    <Pressable accessibilityRole="button" onPress={retry} style={styles.retryBtn}>
                        <Text style={styles.retryLabel}>{t('home.leaveConfig.retry')}</Text>
                    </Pressable>
                </View>
            );
        }
        return (
            <View style={styles.centerBox}>
                <MaterialCommunityIcons name="file-cog-outline" size={40} color={colors.textMuted} />
                <Text style={styles.muted}>
                    {debouncedSearch || activeFilter !== 'all' || paidFilter !== 'all'
                        ? t('home.leaveConfig.emptyFiltered')
                        : t('home.leaveConfig.empty')}
                </Text>
            </View>
        );
    }, [
        accessDenied,
        activeFilter,
        colors.textMuted,
        companyId,
        configs.length,
        debouncedSearch,
        error,
        loading,
        paidFilter,
        retry,
        styles,
        t,
    ]);

    const activeFilters: { id: ActiveFilter; label: string }[] = [
        { id: 'all', label: t('home.leaveConfig.filterAll') },
        { id: 'active', label: t('home.leaveConfig.filterActive') },
        { id: 'inactive', label: t('home.leaveConfig.filterInactive') },
    ];

    const paidFilters: { id: PaidFilter; label: string }[] = [
        { id: 'all', label: t('home.leaveConfig.filterAllPaid') },
        { id: 'paid', label: t('home.leaveConfig.filterPaid') },
        { id: 'unpaid', label: t('home.leaveConfig.filterUnpaid') },
    ];

    return (
        <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
            <View style={styles.stackHeader}>
                <HeaderBackButton
                    onPress={() => navigation.goBack()}
                    tintColor={colors.primary}
                    displayMode="minimal"
                    accessibilityLabel={t('home.leaveConfig.back')}
                />
                <Text
                    style={styles.stackHeaderTitle}
                    numberOfLines={1}
                    accessibilityRole="header">
                    {t('home.leaveConfig.title')}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('home.leaveConfig.createType')}
                    disabled={!canMutate}
                    onPress={openCreateModal}
                    style={({ pressed }) => [
                        styles.headerCreateBtn,
                        !canMutate && styles.headerCreateBtnDisabled,
                        pressed && canMutate && styles.headerCreateBtnPressed,
                    ]}>
                    <MaterialCommunityIcons name="plus" size={22} color="#fff" />
                </Pressable>
            </View>

            <View style={styles.filtersWrap}>
                <View style={styles.searchWrap}>
                    <MaterialCommunityIcons
                        name="magnify"
                        size={18}
                        color={colors.textMuted}
                        style={styles.searchIcon}
                    />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('home.leaveConfig.searchPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        value={search}
                        onChangeText={setSearch}
                        returnKeyType="search"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {search.length > 0 ? (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('home.leaveRequest.clearSearch')}
                            onPress={() => setSearch('')}
                            style={styles.searchClearBtn}>
                            <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
                        </Pressable>
                    ) : null}
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                    contentContainerStyle={styles.chipScrollContent}>
                    {activeFilters.map(filter => {
                        const selected = activeFilter === filter.id;
                        return (
                            <Pressable
                                key={filter.id}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                                onPress={() => setActiveFilter(filter.id)}
                                style={[styles.chip, selected && styles.chipActive]}>
                                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                                    {filter.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                    contentContainerStyle={styles.chipScrollContent}>
                    {paidFilters.map(filter => {
                        const selected = paidFilter === filter.id;
                        return (
                            <Pressable
                                key={filter.id}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                                onPress={() => setPaidFilter(filter.id)}
                                style={[styles.chip, selected && styles.chipActive]}>
                                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                                    {filter.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </View>

            <FlatList
                data={loading && configs.length === 0 ? [] : configs}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={listHeader}
                ListFooterComponent={listFooter}
                ListEmptyComponent={listEmpty}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            refresh();
                        }}
                        tintColor="#7c3aed"
                        colors={['#7c3aed']}
                    />
                }
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            />

            {loading && configs.length > 0 ? (
                <ActivityIndicator style={styles.loadingOverlay} color="#7c3aed" />
            ) : null}

            <LeaveConfigFormModal
                visible={formModalVisible}
                mode={formMode}
                config={editConfig}
                submitting={mutationSubmitting}
                onDismiss={closeFormModal}
                onSubmitCreate={handleCreateSubmit}
                onSubmitUpdate={handleUpdateSubmit}
            />

            <ConfirmAlert {...confirmProps} />
            <StatusAlert {...statusAlertProps} />
        </SafeAreaView>
    );
}

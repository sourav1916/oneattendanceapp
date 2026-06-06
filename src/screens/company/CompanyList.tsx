import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
    FlatList,
    Image,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { createCompany } from '@src/api/createCompany';
import { fetchCompanyList } from '@src/api/fetchCompanyList';
import { updateCompany } from '@src/api/updateCompany';
import { CreateCompany, type CreateCompanyFormPayload } from '@src/components/modals/CreateCompany';
import { ConfirmAlert, useConfirmAlert } from '@src/components/modals/ConfirmAlert';
import { StatusAlert, useStatusAlert } from '@src/components/modals/StatusAlert';
import { UpdateCompanyModal } from '@src/components/modals/UpdateCompanyModal';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { TAB_SCREEN_SAFE_AREA_EDGES } from '@src/constants/tabScreenLayout';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { CompanyListItem, CompanyListMeta } from '@src/types/companyList';
import type { UpdateCompanyPayload } from '@src/types/updateCompany';
import { API_ENDPOINT } from '@src/utils/config';
import { readApiError } from '@src/utils/readApiError';

type Props = NativeStackScreenProps<HomeStackParamList, 'CompanyList'>;

const SEARCH_DEBOUNCE_MS = 450;
const PAGE_SIZE = 20;
const SKELETON_ROWS = 6;

function resolveLogoUrl(path: string | null): string | null {
    if (path == null || path.trim() === '') {
        return null;
    }
    const p = path.trim();
    if (p.startsWith('http://') || p.startsWith('https://')) {
        return p;
    }
    return `${API_ENDPOINT}${p.startsWith('/') ? '' : '/'}${p}`;
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        const a = parts[0]?.[0];
        const b = parts[parts.length - 1]?.[0];
        if (a && b) {
            return `${a}${b}`.toUpperCase();
        }
    }
    const ch = name.trim()[0];
    return ch ? ch.toUpperCase() : '?';
}

function formatLabel(value: string): string {
    return value
        .split(/[\s_]+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

function formatLocation(item: CompanyListItem): string {
    return [item.city, item.state, item.country].filter(Boolean).join(', ');
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
        createHeaderBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            paddingVertical: 8,
            paddingHorizontal: 10,
            marginRight: 2,
            borderRadius: 10,
        },
        createHeaderLabel: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.primary,
        },
        createHeaderBtnPressed: {
            backgroundColor: colors.secondaryButton,
            opacity: 0.92,
        },
        listContent: {
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 32,
        },
        searchWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
            marginBottom: 14,
            minHeight: 48,
        },
        searchIcon: {
            marginRight: 8,
        },
        searchInput: {
            flex: 1,
            paddingVertical: Platform.OS === 'ios' ? 12 : 8,
            fontSize: 16,
            color: colors.text,
        },
        totalCard: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: scheme === 'dark' ? 'rgba(59, 130, 246, 0.18)' : '#eff6ff',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: scheme === 'dark' ? 'rgba(96, 165, 250, 0.45)' : '#bfdbfe',
            paddingVertical: 12,
            paddingHorizontal: 14,
            marginBottom: 14,
        },
        totalLabel: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.textMuted,
        },
        totalValue: {
            fontSize: 22,
            fontWeight: '800',
            color: colors.primary,
            letterSpacing: -0.3,
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
            padding: 14,
            marginBottom: 10,
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
        cardTop: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
        },
        logo: {
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.secondaryButton,
        },
        logoPlaceholder: {
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
        },
        logoInitials: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.primary,
        },
        cardMain: {
            flex: 1,
            minWidth: 0,
        },
        name: {
            fontSize: 17,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 2,
        },
        subline: {
            fontSize: 14,
            color: colors.textMuted,
            lineHeight: 20,
        },
        statusPill: {
            alignSelf: 'flex-start',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            borderWidth: 1,
        },
        statusPillActive: {
            backgroundColor: scheme === 'dark' ? 'rgba(34, 197, 94, 0.14)' : '#f0fdf4',
            borderColor: scheme === 'dark' ? 'rgba(74, 222, 128, 0.4)' : '#bbf7d0',
        },
        statusPillInactive: {
            backgroundColor: scheme === 'dark' ? 'rgba(251, 191, 36, 0.12)' : '#fffbeb',
            borderColor: scheme === 'dark' ? 'rgba(251, 191, 36, 0.35)' : '#fde68a',
        },
        statusPillTextActive: {
            fontSize: 11,
            fontWeight: '700',
            color: scheme === 'dark' ? '#4ade80' : '#15803d',
        },
        statusPillTextInactive: {
            fontSize: 11,
            fontWeight: '700',
            color: scheme === 'dark' ? '#fbbf24' : '#b45309',
        },
        metaLine: {
            marginTop: 10,
            fontSize: 13,
            color: colors.textMuted,
            lineHeight: 18,
        },
        tagRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 8,
        },
        tag: {
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: scheme === 'dark' ? '#334155' : colors.secondaryButton,
            borderWidth: 1,
            borderColor: colors.border,
        },
        tagText: {
            fontSize: 11,
            fontWeight: '600',
            color: colors.text,
        },
        cardActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginLeft: 4,
        },
        rowActionBtn: {
            width: 32,
            height: 32,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: scheme === 'dark' ? '#334155' : colors.secondaryButton,
        },
        footerBox: {
            paddingVertical: 16,
            alignItems: 'center',
        },
        skCard: {
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 10,
        },
        skRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        skSquare: {
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: scheme === 'dark' ? '#334155' : colors.secondaryButton,
        },
        skBar: {
            height: 14,
            borderRadius: 7,
            backgroundColor: scheme === 'dark' ? '#334155' : colors.secondaryButton,
            marginBottom: 8,
        },
        skBarShort: {
            height: 12,
            borderRadius: 6,
            width: '55%',
            backgroundColor: scheme === 'dark' ? '#1e293b' : colors.border,
        },
        skMeta: {
            marginTop: 12,
            height: 12,
            borderRadius: 6,
            width: '70%',
            backgroundColor: scheme === 'dark' ? '#334155' : colors.secondaryButton,
        },
    });
}

function CompanyListSkeleton({
    styles,
    count = SKELETON_ROWS,
}: {
    styles: ReturnType<typeof buildStyles>;
    count?: number;
}) {
    const pulse = useRef(new Animated.Value(0.38)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 0.92,
                    duration: 650,
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0.35,
                    duration: 650,
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => {
            loop.stop();
        };
    }, [pulse]);

    return (
        <Animated.View style={{ opacity: pulse }}>
            {Array.from({ length: count }, (_, i) => (
                <View key={i} style={styles.skCard}>
                    <View style={styles.skRow}>
                        <View style={styles.skSquare} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={[styles.skBar, { width: '62%' }]} />
                            <View style={[styles.skBar, styles.skBarShort]} />
                        </View>
                    </View>
                    <View style={styles.skMeta} />
                </View>
            ))}
        </Animated.View>
    );
}

type RowProps = {
    item: CompanyListItem;
    styles: ReturnType<typeof buildStyles>;
    colors: AppThemeColors;
    activeLabel: string;
    inactiveLabel: string;
    methodsLabel: string;
    currencyLabel: string;
    editLabel: string;
    deleteLabel: string;
    onEdit: () => void;
    onDelete: () => void;
};

function CompanyRow({
    item,
    styles,
    colors,
    activeLabel,
    inactiveLabel,
    methodsLabel,
    currencyLabel,
    editLabel,
    deleteLabel,
    onEdit,
    onDelete,
}: RowProps) {
    const uri = resolveLogoUrl(item.logo_url);
    const location = formatLocation(item);
    const methods =
        item.attendance_methods.length > 0
            ? item.attendance_methods.map(formatLabel).join(', ')
            : null;

    return (
        <View style={styles.card}>
            <View style={styles.cardTop}>
                {uri ? (
                    <Image source={{ uri }} style={styles.logo} accessibilityIgnoresInvertColors />
                ) : (
                    <View style={[styles.logo, styles.logoPlaceholder]}>
                        <Text style={styles.logoInitials}>{getInitials(item.name)}</Text>
                    </View>
                )}
                <View style={styles.cardMain}>
                    <Text style={styles.name} numberOfLines={1}>
                        {item.name}
                    </Text>
                    {item.legal_name ? (
                        <Text style={styles.subline} numberOfLines={2}>
                            {item.legal_name}
                        </Text>
                    ) : null}
                </View>
                <View
                    style={[
                        styles.statusPill,
                        item.is_active ? styles.statusPillActive : styles.statusPillInactive,
                    ]}>
                    <Text
                        style={
                            item.is_active ? styles.statusPillTextActive : styles.statusPillTextInactive
                        }>
                        {item.is_active ? activeLabel : inactiveLabel}
                    </Text>
                </View>
                <View style={styles.cardActions}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={editLabel}
                        onPress={onEdit}
                        style={styles.rowActionBtn}>
                        <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.primary} />
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={deleteLabel}
                        onPress={onDelete}
                        style={styles.rowActionBtn}>
                        <MaterialCommunityIcons name="archive-off-outline" size={16} color={colors.danger} />
                    </Pressable>
                </View>
            </View>
            {location ? <Text style={styles.metaLine}>{location}</Text> : null}
            <View style={styles.tagRow}>
                {methods ? (
                    <View style={styles.tag}>
                        <Text style={styles.tagText}>
                            {methodsLabel}: {methods}
                        </Text>
                    </View>
                ) : null}
                {item.transaction_currency ? (
                    <View style={styles.tag}>
                        <Text style={styles.tagText}>
                            {currencyLabel}: {item.transaction_currency}
                        </Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
}

export function CompanyListScreen({ navigation }: Props) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const { selectedCompany, refreshProfileRole } = useAuth();
    const styles = useMemo(() => buildStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    const { props: confirmProps, present } = useConfirmAlert();
    const { props: statusAlertProps, presentSuccess, presentError } = useStatusAlert();

    const [createOpen, setCreateOpen] = useState(false);
    const [editCompany, setEditCompany] = useState<CompanyListItem | null>(null);
    const [updateSubmitting, setUpdateSubmitting] = useState(false);
    const pendingUpdateRef = useRef<UpdateCompanyPayload | null>(null);
    const pendingDeleteRef = useRef<CompanyListItem | null>(null);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [companies, setCompanies] = useState<CompanyListItem[]>([]);
    const [meta, setMeta] = useState<CompanyListMeta | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const endReachedLock = useRef(false);
    const fetchFirstIdRef = useRef(0);
    const loadedPageRef = useRef(0);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [search]);

    const loadFirst = useCallback(async () => {
        const fetchId = ++fetchFirstIdRef.current;
        loadedPageRef.current = 0;
        setLoading(true);
        setError(null);
        endReachedLock.current = false;
        try {
            const res = await fetchCompanyList({
                search: debouncedSearch,
                page: 1,
                limit: PAGE_SIZE,
            });
            if (fetchId !== fetchFirstIdRef.current) {
                return;
            }
            if (!res.success) {
                setError(res.message?.trim() || t('home.companyList.apiError'));
                setCompanies([]);
                setMeta(null);
                return;
            }
            setCompanies(res.data ?? []);
            setMeta(res.meta);
            loadedPageRef.current = 1;
        } catch (e) {
            if (fetchId !== fetchFirstIdRef.current) {
                return;
            }
            setError(readApiError(e));
            setCompanies([]);
            setMeta(null);
        } finally {
            if (fetchId === fetchFirstIdRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [debouncedSearch, t]);

    useEffect(() => {
        void loadFirst();
    }, [loadFirst]);

    const loadMore = useCallback(async () => {
        if (meta == null || loadingMore || loading) {
            return;
        }
        if (meta.is_last_page) {
            return;
        }
        if (meta.total_pages > 0 && loadedPageRef.current >= meta.total_pages) {
            return;
        }
        setLoadingMore(true);
        try {
            const nextPage = loadedPageRef.current + 1;
            const res = await fetchCompanyList({
                search: debouncedSearch,
                page: nextPage,
                limit: PAGE_SIZE,
            });
            const chunk = res.data;
            if (!res.success || chunk == null) {
                return;
            }
            if (chunk.length === 0) {
                setMeta(m => (m ? { ...m, is_last_page: true } : m));
                return;
            }
            loadedPageRef.current = nextPage;
            setCompanies(prev => [...prev, ...chunk]);
            if (res.meta != null) {
                setMeta(res.meta);
            }
        } catch {
            /* keep existing list */
        } finally {
            setLoadingMore(false);
            endReachedLock.current = false;
        }
    }, [meta, debouncedSearch, loadingMore, loading]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void loadFirst();
    }, [loadFirst]);

    const handleCreateCompany = useCallback(
        async (payload: CreateCompanyFormPayload) => {
            const res = await createCompany(payload);
            if (!res.success) {
                throw new Error(res.message?.trim() || t('home.companyList.createModal.errors.createFailed'));
            }
            present({
                title: t('home.companyList.createModal.successTitle'),
                message: res.message?.trim() || t('home.companyList.createModal.successTitle'),
                buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
            });
            void loadFirst();
        },
        [loadFirst, present, t],
    );

    const onCreateSubmit = useCallback(
        (payload: CreateCompanyFormPayload) => {
            return handleCreateCompany(payload).catch((e: unknown) => {
                present({
                    title: t('home.companyList.createModal.title'),
                    message:
                        e instanceof Error && e.message
                            ? e.message
                            : readApiError(e) || t('home.companyList.createModal.errors.createFailed'),
                    buttons: [{ text: t('settings.alerts.ok'), variant: 'primary' }],
                });
                throw e;
            });
        },
        [handleCreateCompany, present, t],
    );

    const runUpdate = useCallback(
        async (payload: UpdateCompanyPayload) => {
            setUpdateSubmitting(true);
            try {
                const res = await updateCompany(payload);
                if (!res.success) {
                    throw new Error(res.message?.trim() || t('home.companyList.actions.updateFailed'));
                }
                setEditCompany(null);
                presentSuccess(res.message?.trim() || t('home.companyList.actions.updateSuccess'));
                if (selectedCompany?.id === payload.id) {
                    await refreshProfileRole({ silent: true }).catch(() => {});
                }
                await loadFirst();
            } catch (e) {
                presentError(
                    e instanceof Error && e.message
                        ? e.message
                        : readApiError(e) || t('home.companyList.actions.updateFailed'),
                );
            } finally {
                setUpdateSubmitting(false);
                pendingUpdateRef.current = null;
            }
        },
        [loadFirst, presentError, presentSuccess, refreshProfileRole, selectedCompany?.id, t],
    );

    const runDeactivate = useCallback(
        async (company: CompanyListItem) => {
            try {
                const res = await updateCompany({ id: company.id, is_active: false });
                if (!res.success) {
                    throw new Error(res.message?.trim() || t('home.companyList.actions.deleteFailed'));
                }
                presentSuccess(res.message?.trim() || t('home.companyList.actions.deleteSuccess'));
                if (selectedCompany?.id === company.id) {
                    await refreshProfileRole({ silent: true }).catch(() => {});
                }
                await loadFirst();
            } catch (e) {
                presentError(
                    e instanceof Error && e.message
                        ? e.message
                        : readApiError(e) || t('home.companyList.actions.deleteFailed'),
                );
            } finally {
                pendingDeleteRef.current = null;
            }
        },
        [loadFirst, presentError, presentSuccess, refreshProfileRole, selectedCompany?.id, t],
    );

    const openEditModal = useCallback((company: CompanyListItem) => {
        setEditCompany(company);
    }, []);

    const handleUpdateSubmit = useCallback(
        (payload: UpdateCompanyPayload) => {
            pendingUpdateRef.current = payload;
            present({
                title: t('home.companyList.actions.confirmUpdateTitle'),
                message: t('home.companyList.actions.confirmUpdateMessage', {
                    name: editCompany?.name ?? '',
                }),
                buttons: [
                    { text: t('home.companyList.actions.cancel'), variant: 'secondary' },
                    {
                        text: t('home.companyList.actions.confirmUpdateConfirm'),
                        variant: 'primary',
                        onPress: () => {
                            const p = pendingUpdateRef.current;
                            if (p) {
                                runUpdate(p).catch(() => {});
                            }
                        },
                    },
                ],
            });
        },
        [editCompany?.name, present, runUpdate, t],
    );

    const handleDeletePress = useCallback(
        (company: CompanyListItem) => {
            pendingDeleteRef.current = company;
            present({
                title: t('home.companyList.actions.confirmDeleteTitle'),
                message: t('home.companyList.actions.confirmDeleteMessage', { name: company.name }),
                buttons: [
                    { text: t('home.companyList.actions.cancel'), variant: 'secondary' },
                    {
                        text: t('home.companyList.actions.confirmDeleteConfirm'),
                        variant: 'danger',
                        onPress: () => {
                            const c = pendingDeleteRef.current;
                            if (c) {
                                runDeactivate(c).catch(() => {});
                            }
                        },
                    },
                ],
            });
        },
        [present, runDeactivate, t],
    );

    const onEndReached = useCallback(() => {
        if (endReachedLock.current || loading || loadingMore || meta == null) {
            return;
        }
        if (meta.is_last_page) {
            return;
        }
        if (meta.total_pages > 0 && loadedPageRef.current >= meta.total_pages) {
            return;
        }
        endReachedLock.current = true;
        void loadMore();
    }, [loadMore, meta, loading, loadingMore]);

    const listHeader = useMemo(
        () => (
            <View>
                <View style={styles.searchWrap}>
                    <MaterialCommunityIcons
                        name="magnify"
                        size={22}
                        color={colors.textMuted}
                        style={styles.searchIcon}
                        accessibilityElementsHidden
                    />
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder={t('home.companyList.searchPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        clearButtonMode="while-editing"
                        style={styles.searchInput}
                        returnKeyType="search"
                    />
                </View>
                {!loading && meta != null ? (
                    <View
                        style={styles.totalCard}
                        accessibilityLabel={`${t('home.companyList.total')}: ${meta.total}`}>
                        <Text style={styles.totalLabel}>{t('home.companyList.total')}</Text>
                        <Text style={styles.totalValue}>{String(meta.total)}</Text>
                    </View>
                ) : null}
                {loading ? <CompanyListSkeleton styles={styles} /> : null}
            </View>
        ),
        [colors.textMuted, loading, meta, search, styles, t],
    );

    const listFooter = useMemo(() => {
        if (loadingMore) {
            return (
                <View style={styles.footerBox}>
                    <CompanyListSkeleton styles={styles} count={3} />
                </View>
            );
        }
        return null;
    }, [loadingMore, styles]);

    const renderItem = useCallback(
        ({ item }: { item: CompanyListItem }) => (
            <CompanyRow
                item={item}
                styles={styles}
                colors={colors}
                activeLabel={t('home.companyList.active')}
                inactiveLabel={t('home.companyList.inactive')}
                methodsLabel={t('home.companyList.methods')}
                currencyLabel={t('home.companyList.currency')}
                editLabel={t('home.companyList.editCompany')}
                deleteLabel={t('home.companyList.deleteCompany')}
                onEdit={() => openEditModal(item)}
                onDelete={() => handleDeletePress(item)}
            />
        ),
        [colors, handleDeletePress, openEditModal, styles, t],
    );

    const listEmpty = useMemo(() => {
        if (loading) {
            return null;
        }
        if (companies.length === 0) {
            return (
                <View style={styles.centerBox}>
                    <Text style={styles.muted}>{t('home.companyList.empty')}</Text>
                </View>
            );
        }
        return null;
    }, [companies.length, loading, styles, t]);

    const header = (
        <View style={styles.stackHeader}>
            <HeaderBackButton
                onPress={() => navigation.goBack()}
                tintColor={colors.primary}
                displayMode="minimal"
                accessibilityLabel={t('home.companyList.back')}
            />
            <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
                {t('home.companyList.title')}
            </Text>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('home.companyList.create')}
                onPress={() => setCreateOpen(true)}
                style={({ pressed }) => [
                    styles.createHeaderBtn,
                    pressed && styles.createHeaderBtnPressed,
                ]}>
                <Text style={styles.createHeaderLabel}>{t('home.companyList.createShort')}</Text>
                <MaterialCommunityIcons name="plus" size={22} color={colors.primary} />
            </Pressable>
        </View>
    );

    if (error && companies.length === 0 && !loading) {
        return (
            <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
                {header}
                <View style={[styles.centerBox, styles.fill]}>
                    <Text style={styles.error}>{error}</Text>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => void loadFirst()}
                        style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}>
                        <Text style={styles.retryLabel}>{t('home.companyList.retry')}</Text>
                    </Pressable>
                </View>
                <CreateCompany
                    visible={createOpen}
                    onDismiss={() => setCreateOpen(false)}
                    onSubmit={onCreateSubmit}
                />
                <ConfirmAlert {...confirmProps} />
                <StatusAlert {...statusAlertProps} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
            {header}
            <FlatList
                style={styles.fill}
                data={loading ? [] : companies}
                keyExtractor={item => String(item.id)}
                renderItem={renderItem}
                ListHeaderComponent={listHeader}
                ListFooterComponent={listFooter}
                ListEmptyComponent={listEmpty}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
                onEndReached={onEndReached}
                onEndReachedThreshold={0.35}
                showsVerticalScrollIndicator={false}
            />
            <CreateCompany
                visible={createOpen}
                onDismiss={() => setCreateOpen(false)}
                onSubmit={onCreateSubmit}
            />
            <UpdateCompanyModal
                visible={editCompany != null}
                company={editCompany}
                submitting={updateSubmitting}
                onDismiss={() => setEditCompany(null)}
                onSubmit={handleUpdateSubmit}
            />
            <ConfirmAlert {...confirmProps} />
            <StatusAlert {...statusAlertProps} />
        </SafeAreaView>
    );
}

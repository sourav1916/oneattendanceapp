import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

import { fetchEmployeeList } from '@src/api/fetchEmployeeList';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type { EmployeeListItem, EmployeeListMeta } from '@src/types/employeeList';
import { API_ENDPOINT } from '@src/utils/config';
import { readApiError } from '@src/utils/readApiError';

type Props = NativeStackScreenProps<HomeStackParamList, 'StaffList'>;

const SEARCH_DEBOUNCE_MS = 450;
const PAGE_SIZE = 20;
const SKELETON_ROWS = 6;

function formatJoiningDate(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m) {
        return iso.trim();
    }
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y.slice(2)}`;
}

function resolveProfilePictureUrl(path: string | null): string | null {
    if (path == null || path.trim() === '') {
        return null;
    }
    const p = path.trim();
    if (p.startsWith('http://') || p.startsWith('https://')) {
        return p;
    }
    return `${API_ENDPOINT}${p.startsWith('/') ? '' : '/'}${p}`;
}

function formatLabel(value: unknown): string {
    if (value == null) {
        return '';
    }
    if (typeof value === 'object' && 'label' in (value as Record<string, unknown>)) {
        const label = (value as { label?: string }).label;
        if (label) {
            return label;
        }
    }
    const str = typeof value === 'string' ? value : String(value);
    if (!str) {
        return '';
    }
    return str
        .split(/[\s_]+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

function formatShiftSpan(start: string | null, end: string | null): string | null {
    if (!start || !end) {
        return null;
    }
    return `${start.slice(0, 5)}–${end.slice(0, 5)}`;
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

function formatStatCount(value: number | undefined): { text: string; isDash: boolean } {
    if (value === undefined || !Number.isFinite(value)) {
        return { text: '—', isDash: true };
    }
    return { text: String(value), isDash: false };
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
        statRow: {
            flexDirection: 'row',
            gap: 10,
            marginBottom: 14,
        },
        statCard: {
            flex: 1,
            minWidth: 0,
            borderRadius: 14,
            borderWidth: 1,
            paddingVertical: 12,
            paddingHorizontal: 8,
            alignItems: 'center',
            overflow: 'hidden',
            ...Platform.select({
                ios: {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: scheme === 'dark' ? 0.25 : 0.07,
                    shadowRadius: 6,
                },
                android: { elevation: 2 },
            }),
        },
        statCardTotal: {
            backgroundColor: scheme === 'dark' ? 'rgba(59, 130, 246, 0.18)' : '#eff6ff',
            borderColor: scheme === 'dark' ? 'rgba(96, 165, 250, 0.45)' : '#bfdbfe',
        },
        statCardActive: {
            backgroundColor: scheme === 'dark' ? 'rgba(34, 197, 94, 0.14)' : '#f0fdf4',
            borderColor: scheme === 'dark' ? 'rgba(74, 222, 128, 0.4)' : '#bbf7d0',
        },
        statCardInactive: {
            backgroundColor: scheme === 'dark' ? 'rgba(251, 191, 36, 0.12)' : '#fffbeb',
            borderColor: scheme === 'dark' ? 'rgba(251, 191, 36, 0.35)' : '#fde68a',
        },
        statLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
            marginBottom: 6,
            textAlign: 'center',
        },
        statValue: {
            fontSize: 20,
            fontWeight: '800',
            letterSpacing: -0.3,
            minHeight: 26,
            textAlign: 'center',
        },
        statValueTotal: {
            color: colors.primary,
        },
        statValueActive: {
            color: scheme === 'dark' ? '#4ade80' : '#15803d',
        },
        statValueInactive: {
            color: scheme === 'dark' ? '#fbbf24' : '#b45309',
        },
        statValueDash: {
            color: colors.textMuted,
            fontWeight: '600',
        },
        statValueSkelWrap: {
            minHeight: 26,
            justifyContent: 'center',
            alignItems: 'center',
        },
        statSkelBar: {
            height: 22,
            width: 36,
            borderRadius: 6,
            backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(15, 23, 42, 0.1)',
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
        avatar: {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.secondaryButton,
        },
        avatarPlaceholder: {
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
        },
        avatarInitials: {
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
        sublineMuted: {
            fontSize: 13,
            color: colors.textMuted,
            marginTop: 2,
        },
        statusPill: {
            alignSelf: 'flex-start',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: scheme === 'dark' ? '#334155' : colors.secondaryButton,
            borderWidth: 1,
            borderColor: colors.border,
        },
        statusPillText: {
            fontSize: 11,
            fontWeight: '700',
            color: colors.text,
            textTransform: 'capitalize',
        },
        metaRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginTop: 10,
            alignItems: 'center',
        },
        metaLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text,
        },
        metaMuted: {
            fontSize: 13,
            color: colors.textMuted,
            flexShrink: 1,
        },
        shiftLine: {
            marginTop: 8,
            fontSize: 13,
            color: colors.textMuted,
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
        skCircle: {
            width: 48,
            height: 48,
            borderRadius: 24,
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

function StaffStatsSkeleton({
    styles,
    t,
}: {
    styles: ReturnType<typeof buildStyles>;
    t: TFunction;
}) {
    const pulse = useRef(new Animated.Value(0.45)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 700,
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0.38,
                    duration: 700,
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => {
            loop.stop();
        };
    }, [pulse]);

    const items = [
        { key: 'total' as const, card: styles.statCardTotal },
        { key: 'active' as const, card: styles.statCardActive },
        { key: 'inactive' as const, card: styles.statCardInactive },
    ];

    return (
        <View style={styles.statRow}>
            {items.map(({ key, card }) => (
                <View key={key} style={[styles.statCard, card]}>
                    <Text style={styles.statLabel}>{t(`home.staffList.stats.${key}`)}</Text>
                    <View style={styles.statValueSkelWrap}>
                        <Animated.View style={{ opacity: pulse }}>
                            <View style={styles.statSkelBar} />
                        </Animated.View>
                    </View>
                </View>
            ))}
        </View>
    );
}

function StaffStatsRow({
    meta,
    styles,
    t,
}: {
    meta: EmployeeListMeta;
    styles: ReturnType<typeof buildStyles>;
    t: TFunction;
}) {
    const active = formatStatCount(meta.active);
    const inactive = formatStatCount(meta.inactive);

    return (
        <View style={styles.statRow}>
            <View
                style={[styles.statCard, styles.statCardTotal]}
                accessibilityLabel={`${t('home.staffList.stats.total')}: ${meta.total}`}>
                <Text style={styles.statLabel}>{t('home.staffList.stats.total')}</Text>
                <Text style={[styles.statValue, styles.statValueTotal]}>{String(meta.total)}</Text>
            </View>
            <View
                style={[styles.statCard, styles.statCardActive]}
                accessibilityLabel={`${t('home.staffList.stats.active')}: ${active.text}`}>
                <Text style={styles.statLabel}>{t('home.staffList.stats.active')}</Text>
                <Text
                    style={[
                        styles.statValue,
                        styles.statValueActive,
                        active.isDash && styles.statValueDash,
                    ]}>
                    {active.text}
                </Text>
            </View>
            <View
                style={[styles.statCard, styles.statCardInactive]}
                accessibilityLabel={`${t('home.staffList.stats.inactive')}: ${inactive.text}`}>
                <Text style={styles.statLabel}>{t('home.staffList.stats.inactive')}</Text>
                <Text
                    style={[
                        styles.statValue,
                        styles.statValueInactive,
                        inactive.isDash && styles.statValueDash,
                    ]}>
                    {inactive.text}
                </Text>
            </View>
        </View>
    );
}

function StaffListSkeleton({
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
                        <View style={styles.skCircle} />
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
    item: EmployeeListItem;
    styles: ReturnType<typeof buildStyles>;
    joinedLabel: string;
};

function EmployeeRow({ item, styles, joinedLabel }: RowProps) {
    const uri = resolveProfilePictureUrl(item.profile_picture);
    const shift = formatShiftSpan(item.shift_start, item.shift_end);

    return (
        <View style={styles.card}>
            <View style={styles.cardTop}>
                {uri ? (
                    <Image source={{ uri }} style={styles.avatar} accessibilityIgnoresInvertColors />
                ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                        <Text style={styles.avatarInitials}>{getInitials(item.name)}</Text>
                    </View>
                )}
                <View style={styles.cardMain}>
                    <Text style={styles.name} numberOfLines={1}>
                        {item.name}
                    </Text>
                    <Text style={styles.subline} numberOfLines={2}>
                        {[item.employee_code, item.email].filter(Boolean).join(' · ')}
                    </Text>
                    {item.phone ? (
                        <Text style={styles.sublineMuted} numberOfLines={1}>
                            {item.phone}
                        </Text>
                    ) : null}
                </View>
                <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>{formatLabel(item.status)}</Text>
                </View>
            </View>
            <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{formatLabel(item.designation)}</Text>
                {item.package_name ? (
                    <Text style={styles.metaMuted} numberOfLines={1}>
                        {' · '}
                        {item.package_name}
                    </Text>
                ) : null}
            </View>
            <Text style={styles.shiftLine}>
                {formatLabel(item.employment_type)}
                {shift ? ` · ${shift}` : ''}
                {item.joining_date ? ` · ${joinedLabel}: ${formatJoiningDate(item.joining_date)}` : ''}
            </Text>
        </View>
    );
}

export function StaffListScreen({ navigation }: Props) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const styles = useMemo(() => buildStyles(colors, resolvedScheme), [colors, resolvedScheme]);
    const { selectedCompany } = useAuth();
    const companyId = selectedCompany?.id ?? null;

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
    const [meta, setMeta] = useState<EmployeeListMeta | null>(null);
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
        if (companyId == null) {
            setEmployees([]);
            setMeta(null);
            setError(null);
            setLoading(false);
            setRefreshing(false);
            return;
        }
        const fetchId = ++fetchFirstIdRef.current;
        loadedPageRef.current = 0;
        setLoading(true);
        setError(null);
        endReachedLock.current = false;
        try {
            const res = await fetchEmployeeList(companyId, {
                search: debouncedSearch,
                page: 1,
                limit: PAGE_SIZE,
            });
            if (fetchId !== fetchFirstIdRef.current) {
                return;
            }
            if (!res.success) {
                setError(res.message?.trim() || t('home.staffList.apiError'));
                setEmployees([]);
                setMeta(null);
                return;
            }
            setEmployees(res.data ?? []);
            setMeta(res.meta);
            loadedPageRef.current = 1;
        } catch (e) {
            if (fetchId !== fetchFirstIdRef.current) {
                return;
            }
            setError(readApiError(e));
            setEmployees([]);
            setMeta(null);
        } finally {
            if (fetchId === fetchFirstIdRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [companyId, debouncedSearch, t]);

    useEffect(() => {
        void loadFirst();
    }, [loadFirst]);

    const loadMore = useCallback(async () => {
        if (companyId == null || meta == null || loadingMore || loading) {
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
            const res = await fetchEmployeeList(companyId, {
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
            setEmployees(prev => [...prev, ...chunk]);
            setMeta(prev => {
                if (res.meta == null) {
                    return prev;
                }
                return {
                    ...res.meta,
                    active: res.meta.active ?? prev?.active,
                    inactive: res.meta.inactive ?? prev?.inactive,
                };
            });
        } catch {
            /* keep existing list; optional: toast */
        } finally {
            setLoadingMore(false);
            endReachedLock.current = false;
        }
    }, [companyId, meta, debouncedSearch, loadingMore, loading]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void loadFirst();
    }, [loadFirst]);

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
                        placeholder={t('home.staffList.searchPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        clearButtonMode="while-editing"
                        style={styles.searchInput}
                        returnKeyType="search"
                    />
                </View>
                {loading ? (
                    <StaffStatsSkeleton styles={styles} t={t} />
                ) : meta ? (
                    <StaffStatsRow meta={meta} styles={styles} t={t} />
                ) : null}
                {loading ? <StaffListSkeleton styles={styles} /> : null}
            </View>
        ),
        [colors.textMuted, loading, meta, search, styles, t],
    );

    const listFooter = useMemo(() => {
        if (loadingMore) {
            return (
                <View style={styles.footerBox}>
                    <StaffListSkeleton styles={styles} count={3} />
                </View>
            );
        }
        return null;
    }, [loadingMore, styles]);

    const renderItem = useCallback(
        ({ item }: { item: EmployeeListItem }) => (
            <EmployeeRow item={item} styles={styles} joinedLabel={t('home.staffList.joined')} />
        ),
        [styles, t],
    );

    if (companyId == null) {
        return (
            <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
                <View style={styles.stackHeader}>
                    <HeaderBackButton
                        onPress={() => navigation.goBack()}
                        tintColor={colors.primary}
                        displayMode="minimal"
                        accessibilityLabel={t('home.staffList.back')}
                    />
                    <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
                        {t('home.staffList.title')}
                    </Text>
                </View>
                <View style={[styles.centerBox, styles.fill]}>
                    <Text style={styles.muted}>{t('home.staffList.noCompany')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error && employees.length === 0 && !loading) {
        return (
            <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
                <View style={styles.stackHeader}>
                    <HeaderBackButton
                        onPress={() => navigation.goBack()}
                        tintColor={colors.primary}
                        displayMode="minimal"
                        accessibilityLabel={t('home.staffList.back')}
                    />
                    <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
                        {t('home.staffList.title')}
                    </Text>
                </View>
                <View style={[styles.centerBox, styles.fill]}>
                    <Text style={styles.error}>{error}</Text>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => void loadFirst()}
                        style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}>
                        <Text style={styles.retryLabel}>{t('home.staffList.retry')}</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    const listEmpty = useMemo(() => {
        if (loading) {
            return null;
        }
        if (employees.length === 0) {
            return (
                <View style={styles.centerBox}>
                    <Text style={styles.muted}>{t('home.staffList.empty')}</Text>
                </View>
            );
        }
        return null;
    }, [employees.length, loading, styles, t]);

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
            <View style={styles.stackHeader}>
                <HeaderBackButton
                    onPress={() => navigation.goBack()}
                    tintColor={colors.primary}
                    displayMode="minimal"
                    accessibilityLabel={t('home.staffList.back')}
                />
                <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
                    {t('home.staffList.title')}
                </Text>
            </View>

            <FlatList
                style={styles.fill}
                data={loading ? [] : employees}
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
        </SafeAreaView>
    );
}

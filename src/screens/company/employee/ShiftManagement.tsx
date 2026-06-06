import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Image,
    Keyboard,
    Platform,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { IconProps } from 'react-native-vector-icons/Icon';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { ExpandableAnimatedSection } from '@src/components/ExpandableAnimatedSection';
import { MonthPickerModal } from '@src/components/modals/MonthPickerModal';
import {
    TAB_SCREEN_SAFE_AREA_EDGES,
    TAB_SCREEN_SCROLL_PADDING_BOTTOM,
} from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import { useEmployeeShifts } from '@src/hooks/useEmployeeShifts';
import type { HomeStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
    EmployeeShiftMonthlySummary,
    EmployeeShiftRow,
    EmployeeShiftsPageCounts,
} from '@src/types/employeeShifts';
import { resolveProfilePictureUrl } from '@src/utils/attendanceListDisplay';
import { formatMinutes } from '@src/utils/attendanceStatusUi';
import { MONTH_KEYS, shiftMonthYear } from '@src/utils/formatPayrollAmount';

type Props = NativeStackScreenProps<HomeStackParamList, 'ShiftManagement'>;

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;
const SCREEN_PAD = 16;
const NOW = new Date();
const CURRENT_MONTH = NOW.getMonth() + 1;
const CURRENT_YEAR = NOW.getFullYear();

type StatCountKey = keyof EmployeeShiftsPageCounts;
type StatSummaryKey = keyof EmployeeShiftMonthlySummary;

type StatVisual = {
    icon: IconProps['name'];
    color: string;
    softLight: string;
    softDark: string;
    labelKey: string;
    format: 'count' | 'minutes';
};

const SUMMARY_STATS: Array<{ countKey: StatCountKey } & StatVisual> = [
    {
        countKey: 'present_days',
        icon: 'check-circle',
        color: '#16a34a',
        softLight: '#ecfdf5',
        softDark: 'rgba(34,197,94,0.15)',
        labelKey: 'presentDays',
        format: 'count',
    },
    {
        countKey: 'absent_days',
        icon: 'close-circle',
        color: '#dc2626',
        softLight: '#fef2f2',
        softDark: 'rgba(220,38,38,0.15)',
        labelKey: 'absentDays',
        format: 'count',
    },
    {
        countKey: 'leave_days',
        icon: 'calendar-remove',
        color: '#d97706',
        softLight: '#fffbeb',
        softDark: 'rgba(217,119,6,0.15)',
        labelKey: 'leaveDays',
        format: 'count',
    },
    {
        countKey: 'worked_minutes',
        icon: 'clock-outline',
        color: '#2563eb',
        softLight: '#eff6ff',
        softDark: 'rgba(37,99,235,0.15)',
        labelKey: 'worked',
        format: 'minutes',
    },
    {
        countKey: 'overtime_minutes',
        icon: 'clock-plus-outline',
        color: '#7c3aed',
        softLight: '#f5f3ff',
        softDark: 'rgba(124,58,237,0.15)',
        labelKey: 'overtime',
        format: 'minutes',
    },
];

const DETAIL_STATS: Array<{ summaryKey: StatSummaryKey } & StatVisual> = [
    {
        summaryKey: 'present_days',
        icon: 'check-circle',
        color: '#16a34a',
        softLight: '#ecfdf5',
        softDark: 'rgba(34,197,94,0.15)',
        labelKey: 'presentDays',
        format: 'count',
    },
    {
        summaryKey: 'absent_days',
        icon: 'close-circle',
        color: '#dc2626',
        softLight: '#fef2f2',
        softDark: 'rgba(220,38,38,0.15)',
        labelKey: 'absentDays',
        format: 'count',
    },
    {
        summaryKey: 'leave_days',
        icon: 'calendar-remove',
        color: '#d97706',
        softLight: '#fffbeb',
        softDark: 'rgba(217,119,6,0.15)',
        labelKey: 'leaveDays',
        format: 'count',
    },
    {
        summaryKey: 'holiday_days',
        icon: 'beach',
        color: '#0891b2',
        softLight: '#ecfeff',
        softDark: 'rgba(8,145,178,0.15)',
        labelKey: 'holidayDays',
        format: 'count',
    },
    {
        summaryKey: 'weekend_days',
        icon: 'calendar-weekend',
        color: '#6366f1',
        softLight: '#eef2ff',
        softDark: 'rgba(99,102,241,0.15)',
        labelKey: 'weekendDays',
        format: 'count',
    },
];

const MINUTE_STATS: Array<{ summaryKey: StatSummaryKey; icon: IconProps['name']; color: string; labelKey: string }> = [
    { summaryKey: 'worked_minutes', icon: 'clock-outline', color: '#2563eb', labelKey: 'worked' },
    { summaryKey: 'overtime_minutes', icon: 'clock-plus-outline', color: '#7c3aed', labelKey: 'overtime' },
    { summaryKey: 'break_minutes', icon: 'coffee-outline', color: '#64748b', labelKey: 'break' },
];

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    const ch = name.trim()[0];
    return ch ? ch.toUpperCase() : '?';
}

function formatWeekends(days: string[]): string {
    if (days.length === 0) {
        return '';
    }
    return days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
}

function formatStatValue(value: number, format: StatVisual['format']): string {
    return format === 'minutes' ? formatMinutes(value) : String(value);
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
    const isDark = scheme === 'dark';
    const screenBg = isDark ? colors.background : '#eef2ff';
    const cardBg = isDark ? colors.surface : '#ffffff';

    return StyleSheet.create({
        safe: { flex: 1, backgroundColor: screenBg },
        stackHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
            paddingRight: SCREEN_PAD,
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
        headerSpacer: { width: 24 },
        filtersWrap: {
            paddingBottom: 8,
            backgroundColor: screenBg,
        },
        periodCard: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: isDark ? '#312e81' : '#4f46e5',
            ...Platform.select({
                ios: {
                    shadowColor: '#4f46e5',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isDark ? 0.28 : 0.2,
                    shadowRadius: 8,
                },
                android: { elevation: 4 },
            }),
        },
        periodNavBtn: {
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.18)',
        },
        periodCenter: { alignItems: 'center', flex: 1, paddingHorizontal: 8 },
        periodCenterPressed: { opacity: 0.88 },
        periodLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.82)' },
        periodValue: { fontSize: 17, fontWeight: '800', color: '#fff', marginTop: 2 },
        summaryCard: {
            marginBottom: 10,
            padding: 12,
            borderRadius: 12,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor: isDark ? colors.border : '#c7d2fe',
            ...Platform.select({
                ios: {
                    shadowColor: '#6366f1',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0.12 : 0.06,
                    shadowRadius: 4,
                },
                android: { elevation: 1 },
            }),
        },
        summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        summaryItem: {
            width: '47%',
            flexGrow: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 10,
            paddingHorizontal: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: isDark ? colors.border : '#eef2ff',
        },
        summaryIconWrap: {
            width: 34,
            height: 34,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
        },
        summaryTextWrap: { flex: 1, minWidth: 0 },
        summaryLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
        summaryValue: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 2 },
        searchWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: cardBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: isDark ? colors.border : '#c7d2fe',
            paddingHorizontal: 12,
            marginBottom: 10,
            minHeight: 44,
            ...Platform.select({
                ios: {
                    shadowColor: '#6366f1',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0.1 : 0.06,
                    shadowRadius: 4,
                },
                android: { elevation: 1 },
            }),
        },
        searchIcon: { marginRight: 8 },
        searchInput: {
            flex: 1,
            paddingVertical: Platform.OS === 'ios' ? 10 : 8,
            fontSize: 15,
            color: colors.text,
        },
        clearBtn: { padding: 6, marginRight: -4 },
        listContent: {
            paddingHorizontal: SCREEN_PAD,
            paddingTop: 4,
            paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
        },
        card: {
            borderRadius: 14,
            borderWidth: 1,
            borderColor: isDark ? colors.border : '#e0e7ff',
            backgroundColor: cardBg,
            marginBottom: 10,
            overflow: 'hidden',
            ...Platform.select({
                ios: {
                    shadowColor: '#6366f1',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: isDark ? 0.12 : 0.07,
                    shadowRadius: 6,
                },
                android: { elevation: 2 },
            }),
        },
        cardPressed: { opacity: 0.92 },
        cardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
        },
        avatar: {
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 2,
            borderColor: isDark ? '#818cf8' : '#a5b4fc',
            backgroundColor: isDark ? '#334155' : colors.secondaryButton,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
        },
        avatarImg: { width: '100%', height: '100%' },
        avatarText: { fontSize: 14, fontWeight: '800', color: isDark ? '#c7d2fe' : colors.primary },
        cardMain: { flex: 1, minWidth: 0 },
        nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
        employeeName: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
        statusBadge: {
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 6,
            borderWidth: 1,
        },
        statusActive: {
            backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : '#f0fdf4',
            borderColor: isDark ? 'rgba(74,222,128,0.4)' : '#bbf7d0',
        },
        statusInactive: {
            backgroundColor: isDark ? 'rgba(148,163,184,0.15)' : '#f1f5f9',
            borderColor: isDark ? 'rgba(148,163,184,0.35)' : '#cbd5e1',
        },
        statusTextActive: {
            fontSize: 10,
            fontWeight: '700',
            color: isDark ? '#4ade80' : '#15803d',
        },
        statusTextInactive: {
            fontSize: 10,
            fontWeight: '700',
            color: isDark ? '#94a3b8' : '#64748b',
        },
        employeeSnippet: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        chevronWrap: { padding: 4 },
        cardDetailsInner: {
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: 14,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: isDark ? colors.border : '#e2e8f0',
            backgroundColor: isDark ? colors.background : '#f8fafc',
        },
        metaRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: 8,
        },
        metaIconWrap: {
            width: 28,
            height: 28,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? '#334155' : '#eef2ff',
        },
        metaText: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 17, paddingTop: 4 },
        statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
        statBox: {
            width: '47%',
            flexGrow: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: isDark ? colors.border : '#eef2ff',
            backgroundColor: cardBg,
        },
        statIconWrap: {
            width: 30,
            height: 30,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
        },
        statTextWrap: { flex: 1, minWidth: 0 },
        statLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
        statValue: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 1 },
        minutesSection: {
            marginTop: 10,
            paddingTop: 10,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: isDark ? colors.border : '#e2e8f0',
            gap: 8,
        },
        minutesSectionTitle: {
            fontSize: 11,
            fontWeight: '700',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
        },
        minutesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        minutePill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: isDark ? colors.border : '#e2e8f0',
            backgroundColor: cardBg,
        },
        minuteText: { fontSize: 11, fontWeight: '600', color: colors.text },
        centerBox: {
            paddingVertical: 48,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
        },
        muted: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
        error: { fontSize: 15, color: colors.danger, textAlign: 'center', lineHeight: 22 },
        retryBtn: {
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 12,
            backgroundColor: colors.primary,
        },
        retryLabel: { color: '#fff', fontWeight: '600', fontSize: 15 },
        pagination: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 12,
            gap: 12,
        },
        pageBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: cardBg,
        },
        pageBtnDisabled: { opacity: 0.45 },
        pageBtnLabel: { fontSize: 14, fontWeight: '600', color: colors.primary },
        pageInfo: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
        skeleton: {
            height: 64,
            borderRadius: 14,
            backgroundColor: isDark ? '#334155' : '#e2e8f0',
            marginBottom: 10,
            opacity: 0.55,
        },
    });
}

type Styles = ReturnType<typeof buildStyles>;

type SummaryStatProps = {
    stat: (typeof SUMMARY_STATS)[number];
    value: number;
    isDark: boolean;
    styles: Styles;
    t: (key: string) => string;
};

function SummaryStatItem({ stat, value, isDark, styles, t }: SummaryStatProps) {
    const softBg = isDark ? stat.softDark : stat.softLight;
    return (
        <View style={[styles.summaryItem, { backgroundColor: softBg, borderColor: `${stat.color}33` }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: `${stat.color}22` }]}>
                <MaterialCommunityIcons name={stat.icon} size={18} color={stat.color} />
            </View>
            <View style={styles.summaryTextWrap}>
                <Text style={styles.summaryLabel}>{t(`home.shiftManagement.${stat.labelKey}`)}</Text>
                <Text style={[styles.summaryValue, { color: stat.color }]}>
                    {formatStatValue(value, stat.format)}
                </Text>
            </View>
        </View>
    );
}

type DetailStatProps = {
    stat: (typeof DETAIL_STATS)[number];
    value: number;
    isDark: boolean;
    styles: Styles;
    t: (key: string) => string;
};

function DetailStatItem({ stat, value, isDark, styles, t }: DetailStatProps) {
    const softBg = isDark ? stat.softDark : stat.softLight;
    return (
        <View style={[styles.statBox, { backgroundColor: softBg, borderColor: `${stat.color}33` }]}>
            <View style={[styles.statIconWrap, { backgroundColor: `${stat.color}22` }]}>
                <MaterialCommunityIcons name={stat.icon} size={16} color={stat.color} />
            </View>
            <View style={styles.statTextWrap}>
                <Text style={styles.statLabel}>{t(`home.shiftManagement.${stat.labelKey}`)}</Text>
                <Text style={[styles.statValue, { color: stat.color }]}>{String(value)}</Text>
            </View>
        </View>
    );
}

type RowProps = {
    item: EmployeeShiftRow;
    styles: Styles;
    scheme: 'light' | 'dark';
    colors: AppThemeColors;
    t: (key: string, opts?: Record<string, unknown>) => string;
};

const ShiftEmployeeRow = React.memo(function ShiftEmployeeRow({
    item,
    styles,
    scheme,
    colors,
    t,
}: RowProps) {
    const [expanded, setExpanded] = useState(false);
    const chevronAnim = useRef(new Animated.Value(0)).current;
    const isDark = scheme === 'dark';
    const photoUri = resolveProfilePictureUrl(item.profile_picture);
    const designation = item.designation?.label ?? item.designation?.value ?? '';
    const employmentType = item.employment_type?.label ?? item.employment_type?.value ?? '';
    const summary = item.monthly_summary;
    const weekends = formatWeekends(item.weekends);
    const isActive = item.status;

    useEffect(() => {
        Animated.timing(chevronAnim, {
            toValue: expanded ? 1 : 0,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [chevronAnim, expanded]);

    const chevronRotate = chevronAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    const snippet = [
        item.employee_code,
        `${t('home.shiftManagement.presentDays')}: ${summary.present_days}`,
        `${t('home.shiftManagement.absentDays')}: ${summary.absent_days}`,
    ]
        .filter(Boolean)
        .join(' · ');

    const minuteItems = MINUTE_STATS.filter(
        m => m.summaryKey !== 'break_minutes' || summary.break_minutes > 0,
    );

    return (
        <View style={styles.card}>
            <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => setExpanded(prev => !prev)}
                style={({ pressed }) => [styles.cardHeader, pressed && styles.cardPressed]}>
                <View style={styles.avatar}>
                    {photoUri ? (
                        <Image
                            source={{ uri: photoUri }}
                            style={styles.avatarImg}
                            accessibilityIgnoresInvertColors
                        />
                    ) : (
                        <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                    )}
                </View>
                <View style={styles.cardMain}>
                    <View style={styles.nameRow}>
                        <Text style={styles.employeeName} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <View
                            style={[
                                styles.statusBadge,
                                isActive ? styles.statusActive : styles.statusInactive,
                            ]}>
                            <Text style={isActive ? styles.statusTextActive : styles.statusTextInactive}>
                                {isActive
                                    ? t('home.shiftManagement.employeeActive')
                                    : t('home.shiftManagement.employeeInactive')}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.employeeSnippet} numberOfLines={1}>
                        {snippet}
                    </Text>
                </View>
                <Animated.View style={[styles.chevronWrap, { transform: [{ rotate: chevronRotate }] }]}>
                    <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
                </Animated.View>
            </Pressable>

            <ExpandableAnimatedSection expanded={expanded} contentStyle={styles.cardDetailsInner}>
                {designation ? (
                    <View style={styles.metaRow}>
                        <View style={styles.metaIconWrap}>
                            <MaterialCommunityIcons name="briefcase-outline" size={15} color="#6366f1" />
                        </View>
                        <Text style={styles.metaText}>{designation}</Text>
                    </View>
                ) : null}
                {employmentType ? (
                    <View style={styles.metaRow}>
                        <View style={styles.metaIconWrap}>
                            <MaterialCommunityIcons name="account-tie-outline" size={15} color="#0891b2" />
                        </View>
                        <Text style={styles.metaText}>{employmentType}</Text>
                    </View>
                ) : null}
                <View style={styles.metaRow}>
                    <View style={styles.metaIconWrap}>
                        <MaterialCommunityIcons name="calendar-start" size={15} color="#d97706" />
                    </View>
                    <Text style={styles.metaText}>
                        {t('home.shiftManagement.joinedOn', { date: item.joining_date })}
                        {weekends ? ` · ${t('home.shiftManagement.weekends', { days: weekends })}` : ''}
                    </Text>
                </View>

                <View style={styles.statsGrid}>
                    {DETAIL_STATS.map(stat => (
                        <DetailStatItem
                            key={stat.summaryKey}
                            stat={stat}
                            value={summary[stat.summaryKey]}
                            isDark={isDark}
                            styles={styles}
                            t={t}
                        />
                    ))}
                </View>

                <View style={styles.minutesSection}>
                    <Text style={styles.minutesSectionTitle}>{t('home.shiftManagement.timeSummary')}</Text>
                    <View style={styles.minutesRow}>
                        {minuteItems.map(minute => (
                            <View key={minute.summaryKey} style={styles.minutePill}>
                                <MaterialCommunityIcons name={minute.icon} size={14} color={minute.color} />
                                <Text style={styles.minuteText}>
                                    {t(`home.shiftManagement.${minute.labelKey}`)}:{' '}
                                    {formatMinutes(summary[minute.summaryKey])}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            </ExpandableAnimatedSection>
        </View>
    );
});

export function ShiftManagementScreen({ navigation }: Props) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const isDark = resolvedScheme === 'dark';
    const styles = useMemo(
        () => buildStyles(colors, resolvedScheme),
        [colors, resolvedScheme],
    );
    const { selectedCompany } = useAuth();
    const companyId = selectedCompany?.id ?? null;

    const [month, setMonth] = useState(CURRENT_MONTH);
    const [year, setYear] = useState(CURRENT_YEAR);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [searchKeyboardVisible, setSearchKeyboardVisible] = useState(false);
    const [pickerVisible, setPickerVisible] = useState(false);
    const searchInputRef = useRef<TextInput>(null);

    const monthLabels = useMemo(
        () => MONTH_KEYS.map(key => t(`home.shiftManagement.months.${key}`)),
        [t],
    );

    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [month, year, debouncedSearch]);

    useEffect(() => {
        if (!searchFocused) {
            setSearchKeyboardVisible(false);
            return;
        }
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, () => setSearchKeyboardVisible(true));
        const hideSub = Keyboard.addListener(hideEvent, () => setSearchKeyboardVisible(false));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [searchFocused]);

    const hideSummary = searchFocused || searchKeyboardVisible;

    const handleClearSearch = useCallback(() => {
        setSearch('');
        setDebouncedSearch('');
        setSearchFocused(false);
        setSearchKeyboardVisible(false);
        searchInputRef.current?.blur();
        Keyboard.dismiss();
    }, []);

    const {
        employees,
        meta,
        loading,
        refreshing,
        error,
        accessDenied,
        refresh,
        retry,
    } = useEmployeeShifts({
        companyId,
        month,
        year,
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch,
    });

    const periodLabel = t(`home.shiftManagement.months.${MONTH_KEYS[month - 1]}`);
    const canGoPrev = page > 1;
    const canGoNext = meta != null && !meta.is_last_page && page < meta.total_pages;

    const goPrevPeriod = useCallback(() => {
        const next = shiftMonthYear(month, year, -1);
        setMonth(next.month);
        setYear(next.year);
    }, [month, year]);

    const goNextPeriod = useCallback(() => {
        const next = shiftMonthYear(month, year, 1);
        setMonth(next.month);
        setYear(next.year);
    }, [month, year]);

    const handlePickerConfirm = useCallback((nextMonth: number, nextYear: number) => {
        setMonth(nextMonth);
        setYear(nextYear);
    }, []);

    const renderItem = useCallback(
        ({ item }: { item: EmployeeShiftRow }) => (
            <ShiftEmployeeRow
                item={item}
                styles={styles}
                scheme={resolvedScheme}
                colors={colors}
                t={t}
            />
        ),
        [colors, resolvedScheme, styles, t],
    );

    const listHeader = useMemo(
        () => (
            <View style={styles.filtersWrap}>
                <View style={styles.periodCard}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('home.shiftManagement.prevPeriod')}
                        onPress={goPrevPeriod}
                        style={styles.periodNavBtn}>
                        <MaterialCommunityIcons name="chevron-left" size={20} color="#fff" />
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('home.shiftManagement.selectPeriod')}
                        onPress={() => setPickerVisible(true)}
                        style={({ pressed }) => [styles.periodCenter, pressed && styles.periodCenterPressed]}>
                        <Text style={styles.periodLabel}>{t('home.shiftManagement.periodLabel')}</Text>
                        <Text style={styles.periodValue}>
                            {periodLabel} {year}
                        </Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('home.shiftManagement.nextPeriod')}
                        onPress={goNextPeriod}
                        style={styles.periodNavBtn}>
                        <MaterialCommunityIcons name="chevron-right" size={20} color="#fff" />
                    </Pressable>
                </View>

                <View style={styles.searchWrap}>
                    <MaterialCommunityIcons
                        name="magnify"
                        size={18}
                        color={colors.textMuted}
                        style={styles.searchIcon}
                    />
                    <TextInput
                        ref={searchInputRef}
                        value={search}
                        onChangeText={setSearch}
                        placeholder={t('home.shiftManagement.searchPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                        style={styles.searchInput}
                    />
                    {search.length > 0 ? (
                        <Pressable
                            style={styles.clearBtn}
                            onPress={handleClearSearch}
                            accessibilityRole="button"
                            accessibilityLabel={t('home.shiftManagement.clearSearch', {
                                defaultValue: 'Clear search',
                            })}>
                            <MaterialCommunityIcons
                                name="close-circle"
                                size={18}
                                color={colors.textMuted}
                            />
                        </Pressable>
                    ) : null}
                </View>

                {meta != null && !loading && !hideSummary ? (
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryGrid}>
                            {SUMMARY_STATS.map(stat => (
                                <SummaryStatItem
                                    key={stat.countKey}
                                    stat={stat}
                                    value={meta.counts[stat.countKey]}
                                    isDark={isDark}
                                    styles={styles}
                                    t={t}
                                />
                            ))}
                        </View>
                    </View>
                ) : null}

                {loading ? (
                    <>
                        <View style={styles.skeleton} />
                        <View style={styles.skeleton} />
                        <View style={styles.skeleton} />
                    </>
                ) : null}
            </View>
        ),
        [
            colors.textMuted,
            goNextPeriod,
            goPrevPeriod,
            handleClearSearch,
            hideSummary,
            isDark,
            loading,
            meta,
            periodLabel,
            search,
            styles,
            t,
            year,
        ],
    );

    const listFooter = useMemo(() => {
        if (loading || meta == null || meta.total_pages <= 1) {
            return null;
        }
        return (
            <View style={styles.pagination}>
                <Pressable
                    accessibilityRole="button"
                    disabled={!canGoPrev}
                    onPress={() => canGoPrev && setPage(p => p - 1)}
                    style={[styles.pageBtn, !canGoPrev && styles.pageBtnDisabled]}>
                    <MaterialCommunityIcons name="chevron-left" size={18} color={colors.primary} />
                    <Text style={styles.pageBtnLabel}>{t('home.shiftManagement.prevPage')}</Text>
                </Pressable>
                <Text style={styles.pageInfo}>
                    {t('home.shiftManagement.pageOf', { page: meta.page, total: meta.total_pages })}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    disabled={!canGoNext}
                    onPress={() => canGoNext && setPage(p => p + 1)}
                    style={[styles.pageBtn, !canGoNext && styles.pageBtnDisabled]}>
                    <Text style={styles.pageBtnLabel}>{t('home.shiftManagement.nextPage')}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primary} />
                </Pressable>
            </View>
        );
    }, [canGoNext, canGoPrev, colors.primary, loading, meta, styles, t]);

    const listEmpty = useMemo(() => {
        if (loading) {
            return null;
        }
        if (companyId == null) {
            return (
                <View style={styles.centerBox}>
                    <Text style={styles.muted}>{t('home.shiftManagement.noCompany')}</Text>
                </View>
            );
        }
        if (accessDenied) {
            return (
                <View style={styles.centerBox}>
                    <MaterialCommunityIcons name="shield-lock-outline" size={40} color={colors.textMuted} />
                    <Text style={styles.error}>{t('home.shiftManagement.accessDenied')}</Text>
                </View>
            );
        }
        if (error) {
            return (
                <View style={styles.centerBox}>
                    <Text style={styles.error}>{error}</Text>
                    <Pressable accessibilityRole="button" onPress={retry} style={styles.retryBtn}>
                        <Text style={styles.retryLabel}>{t('home.shiftManagement.retry')}</Text>
                    </Pressable>
                </View>
            );
        }
        return (
            <View style={styles.centerBox}>
                <Text style={styles.muted}>{t('home.shiftManagement.empty')}</Text>
            </View>
        );
    }, [accessDenied, companyId, error, loading, colors.textMuted, retry, styles, t]);

    return (
        <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
            <View style={styles.stackHeader}>
                <HeaderBackButton
                    onPress={() => navigation.goBack()}
                    tintColor={colors.primary}
                    displayMode="minimal"
                    accessibilityLabel={t('home.shiftManagement.back')}
                />
                <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
                    {t('home.shiftManagement.title')}
                </Text>
                {refreshing ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                    <View style={styles.headerSpacer} />
                )}
            </View>

            <FlatList
                data={loading ? [] : employees}
                keyExtractor={item => String(item.employee_id)}
                renderItem={renderItem}
                ListHeaderComponent={listHeader}
                ListFooterComponent={listFooter}
                ListEmptyComponent={listEmpty}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
                }
                showsVerticalScrollIndicator={false}
            />

            <MonthPickerModal
                visible={pickerVisible}
                month={month}
                year={year}
                monthLabels={monthLabels}
                onDismiss={() => setPickerVisible(false)}
                onConfirm={handlePickerConfirm}
            />
        </SafeAreaView>
    );
}

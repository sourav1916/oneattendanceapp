/**
 * @format
 */
import { HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Animated,
    Easing,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { fetchMyCalendar } from '@src/api/fetchMyCalendar';
import {
    TAB_SCREEN_SAFE_AREA_EDGES,
    TAB_SCREEN_SCROLL_PADDING_BOTTOM,
} from '@src/constants/tabScreenLayout';
import { useAuth } from '@src/context/AuthContext';
import { useAppTheme, useThemeColors } from '@src/context/ThemeContext';
import type { HomeStackParamList, SettingsStackParamList } from '@src/navigation/types';
import type { AppThemeColors } from '@src/theme/palettes';
import type {
    CalendarActivity,
    CalendarBreak,
    CalendarDayInfo,
    CalendarDayStatus,
    CalendarLog,
    CalendarShift,
    MyCalendarData,
} from '@src/types/myCalendar';
import {
    buildCalendarGrid,
    computeCalendarSummary,
    formatAttendanceMethod,
    formatCreatedByLabel,
    formatLogTypeLabel,
    formatMinutesToDuration,
    formatMonthTitle,
    formatStatusLabel,
    getStatusStyle,
    hasCalendarDayDetails,
    shiftMonth,
    type CalendarDaySummary,
    type CalendarGridCell,
    type StatusVisualStyle,
} from '@src/utils/calendarHelpers';
import { readApiError } from '@src/utils/readApiError';

type Props =
    | NativeStackScreenProps<HomeStackParamList, 'MyCalendar'>
    | NativeStackScreenProps<SettingsStackParamList, 'MyCalendar'>;

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const CALENDAR_CELL_MIN_HEIGHT = 44;
const WEEK_ROW_GAP = 8;

const NON_CLICKABLE_STATUSES: CalendarDayStatus[] = ['not_joined', 'upcoming'];

function isCalendarDayPressable(
    status: CalendarDayStatus | string | undefined,
    dayInfo?: CalendarDayInfo | null,
): boolean {
    if (status == null) {
        return false;
    }
    if (!NON_CLICKABLE_STATUSES.includes(status as CalendarDayStatus)) {
        return true;
    }
    return hasCalendarDayDetails(dayInfo);
}

function chunkCalendarWeeks(grid: CalendarGridCell[]): CalendarGridCell[][] {
    const weeks: CalendarGridCell[][] = [];
    for (let i = 0; i < grid.length; i += 7) {
        const week = grid.slice(i, i + 7);
        while (week.length < 7) {
            week.push({ day: null, dateKey: null, dayInfo: null });
        }
        weeks.push(week);
    }
    return weeks;
}

const SUMMARY_KEYS: Array<{
    key: keyof CalendarDaySummary;
    labelKey: string;
    status?: CalendarDayStatus;
}> = [
        { key: 'present', labelKey: 'present', status: 'present' },
        { key: 'absent', labelKey: 'absent', status: 'absent' },
        { key: 'leave', labelKey: 'leave', status: 'leave' },
        { key: 'holiday', labelKey: 'holiday', status: 'holiday' },
        { key: 'weekend', labelKey: 'weekend', status: 'weekend' },
        { key: 'half_day', labelKey: 'halfDay', status: 'half_day' },
        { key: 'upcoming', labelKey: 'upcoming', status: 'upcoming' },
        { key: 'not_joined', labelKey: 'notJoined', status: 'not_joined' },
    ];

function resolveCalendarFetchError(err: unknown, t: (key: string) => string): string {
    if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) {
            return '';
        }
        if (status === 400) {
            return readApiError(err);
        }
        if (status != null && status >= 500) {
            return t('home.myCalendar.errors.server');
        }
    }
    return readApiError(err);
}

function formatDisplayDate(dateKey: string): string {
    const [y, m, d] = dateKey.split('-');
    if (!y || !m || !d) {
        return dateKey;
    }
    const monthIndex = Number(m) - 1;
    const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
    ];
    return `${months[monthIndex] ?? m} ${Number(d)}, ${y}`;
}

function buildStyles(colors: AppThemeColors, scheme: 'light' | 'dark') {
    return StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: colors.background,
        },
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
            fontWeight: '600',
            color: colors.text,
            marginLeft: 2,
        },
        scroll: {
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: TAB_SCREEN_SCROLL_PADDING_BOTTOM,
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
            fontSize: 15,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 10,
        },
        monthNav: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
        },
        monthNavBtn: {
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.secondaryButton,
            alignItems: 'center',
            justifyContent: 'center',
        },
        monthNavTitle: {
            fontSize: 17,
            fontWeight: '700',
            color: colors.text,
        },
        weekdayRow: {
            flexDirection: 'row',
            marginBottom: 6,
        },
        weekdayCol: {
            flex: 1,
            alignItems: 'center',
        },
        weekdayLabel: {
            textAlign: 'center',
            fontSize: 11,
            fontWeight: '600',
            color: colors.textMuted,
        },
        gridWeekRow: {
            flexDirection: 'row',
            marginBottom: WEEK_ROW_GAP,
        },
        gridWeekRowLast: {
            marginBottom: 0,
        },
        gridCell: {
            flex: 1,
            minHeight: CALENDAR_CELL_MIN_HEIGHT,
            padding: 2,
            maxWidth: '14.2857%',
        },
        dayCell: {
            flex: 1,
            borderRadius: 10,
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 2,
            paddingHorizontal: 1,
        },
        dayNumber: {
            fontSize: 13,
            fontWeight: '700',
        },
        dayStatus: {
            fontSize: 8,
            fontWeight: '600',
            marginTop: 1,
            textTransform: 'capitalize',
        },
        legendWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 10,
        },
        legendItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
        },
        legendSwatch: {
            width: 10,
            height: 10,
            borderRadius: 3,
            borderWidth: 1,
        },
        legendText: {
            fontSize: 11,
            color: colors.textMuted,
        },
        summaryGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        summaryCard: {
            width: '48%',
            flexGrow: 1,
            minWidth: '46%',
            backgroundColor: colors.background,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 10,
            paddingHorizontal: 10,
        },
        summaryCount: {
            fontSize: 20,
            fontWeight: '700',
            color: colors.text,
        },
        summaryLabel: {
            fontSize: 12,
            color: colors.textMuted,
            marginTop: 2,
        },
        modalSafe: {
            flex: 1,
            backgroundColor: colors.overlay,
        },
        modalBackdrop: {
            ...StyleSheet.absoluteFill,
        },
        modalSheetWrap: {
            flex: 1,
            justifyContent: 'flex-end',
            paddingTop: 48,
        },
        modalSheet: {
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.border,
            maxHeight: '88%',
            overflow: 'hidden',
        },
        modalHandle: {
            alignSelf: 'center',
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            marginBottom: 16,
        },
        modalHeader: {
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 14,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        modalTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 4,
        },
        modalStatus: {
            fontSize: 14,
            fontWeight: '600',
        },
        modalStatusPill: {
            alignSelf: 'flex-start',
            borderRadius: 999,
            borderWidth: 1,
            paddingHorizontal: 10,
            paddingVertical: 5,
            marginTop: 8,
        },
        modalScroll: {
            flexGrow: 0,
            flexShrink: 1,
        },
        modalScrollContent: {
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 20,
        },
        detailSummaryCard: {
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: scheme === 'dark' ? '#0f172a' : colors.background,
            paddingHorizontal: 14,
            paddingVertical: 8,
            marginBottom: 16,
        },
        detailRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 12,
            paddingVertical: 8,
        },
        detailLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.textMuted,
            flex: 1,
        },
        detailValue: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            flex: 1,
            textAlign: 'right',
        },
        shiftRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 12,
            paddingVertical: 6,
        },
        shiftLabel: {
            fontSize: 14,
            color: colors.textMuted,
        },
        shiftValue: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
        },
        sessionBlock: {
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 12,
            marginBottom: 10,
        },
        modalClose: {
            marginHorizontal: 20,
            marginTop: 2,
            marginBottom: 16,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: 'center',
        },
        modalCloseLabel: {
            color: '#fff',
            fontWeight: '600',
            fontSize: 16,
        },
        sectionHeading: {
            fontSize: 13,
            fontWeight: '700',
            color: colors.text,
            marginTop: 4,
            marginBottom: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
        },
        timelineList: {
            gap: 10,
            marginBottom: 16,
        },
        timelineCard: {
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: scheme === 'dark' ? '#0f172a' : colors.background,
            padding: 12,
            ...Platform.select({
                ios: {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: scheme === 'dark' ? 0.16 : 0.05,
                    shadowRadius: 4,
                },
                android: { elevation: 1 },
            }),
        },
        timelineHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        timelineIcon: {
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.secondaryButton,
        },
        timelineText: {
            flex: 1,
        },
        timelineTitle: {
            fontSize: 15,
            fontWeight: '700',
            color: colors.text,
        },
        timelineTime: {
            fontSize: 13,
            color: colors.textMuted,
            marginTop: 2,
        },
        timelineMetaRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 10,
        },
        timelineMethodPill: {
            borderRadius: 999,
            backgroundColor: colors.secondaryButton,
            paddingHorizontal: 10,
            paddingVertical: 5,
        },
        timelineMethodText: {
            fontSize: 12,
            fontWeight: '700',
            color: colors.text,
        },
        timelineByline: {
            fontSize: 12,
            color: colors.textMuted,
            lineHeight: 18,
            marginTop: 8,
        },
        skPulseBase: {
            backgroundColor: colors.border,
        },
        skLine: {
            height: 12,
            borderRadius: 6,
            marginBottom: 8,
        },
        skMonthTitle: {
            width: 140,
            height: 18,
            borderRadius: 8,
            alignSelf: 'center',
        },
        skDayCell: {
            flex: 1,
            minHeight: CALENDAR_CELL_MIN_HEIGHT,
            margin: 2,
            borderRadius: 10,
            maxWidth: '14.2857%',
        },
        skSummaryCard: {
            width: '48%',
            flexGrow: 1,
            minWidth: '46%',
            minHeight: 58,
            borderRadius: 10,
        },
    });
}

function useSkeletonPulse() {
    const pulse = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1,
                    duration: 850,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 0,
                    duration: 850,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);
    return {
        opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.35, 0.7],
        }),
    };
}

function CalendarContentSkeleton({
    styles,
}: {
    styles: ReturnType<typeof buildStyles>;
}) {
    const pulseStyle = useSkeletonPulse();
    const bone = (...extra: object[]) => [styles.skPulseBase, pulseStyle, ...extra];

    return (
        <>
            <View style={styles.card}>
                <View style={styles.monthNav}>
                    <Animated.View style={[{ width: 40, height: 40, borderRadius: 12 }, ...bone()]} />
                    <Animated.View style={[styles.skMonthTitle, ...bone()]} />
                    <Animated.View style={[{ width: 40, height: 40, borderRadius: 12 }, ...bone()]} />
                </View>

                <View style={styles.weekdayRow}>
                    {WEEKDAY_LABELS.map(label => (
                        <View key={label} style={styles.weekdayCol}>
                            <Text style={styles.weekdayLabel}>{label}</Text>
                        </View>
                    ))}
                </View>

                {Array.from({ length: 6 }).map((_, weekIndex) => (
                    <View
                        key={weekIndex}
                        style={[
                            styles.gridWeekRow,
                            weekIndex === 5 && styles.gridWeekRowLast,
                        ]}>
                        {Array.from({ length: 7 }).map((__, dayIndex) => (
                            <Animated.View key={dayIndex} style={[styles.skDayCell, ...bone()]} />
                        ))}
                    </View>
                ))}
            </View>

            <View style={styles.card}>
                <Animated.View style={[styles.skLine, { width: '50%', marginBottom: 12 }, ...bone()]} />
                <View style={styles.summaryGrid}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Animated.View key={i} style={[styles.skSummaryCard, ...bone()]} />
                    ))}
                </View>
            </View>
        </>
    );
}

type DayDetailModalProps = {
    visible: boolean;
    dateKey: string | null;
    dayInfo: CalendarDayInfo | null;
    onClose: () => void;
    styles: ReturnType<typeof buildStyles>;
    t: (key: string) => string;
};

type TimelineEntryProps = {
    icon: string;
    title: string;
    time?: string;
    method?: string;
    byLine?: string | null;
    styles: ReturnType<typeof buildStyles>;
};

function TimelineEntry({ icon, title, time, method, byLine, styles }: TimelineEntryProps) {
    return (
        <View style={styles.timelineCard}>
            <View style={styles.timelineHeader}>
                <View style={styles.timelineIcon}>
                    <MaterialCommunityIcons name={icon} size={18} color="#2563eb" />
                </View>
                <View style={styles.timelineText}>
                    <Text style={styles.timelineTitle}>{title}</Text>
                    {time ? <Text style={styles.timelineTime}>{time}</Text> : null}
                </View>
            </View>
            {method ? (
                <View style={styles.timelineMetaRow}>
                    <View style={styles.timelineMethodPill}>
                        <Text style={styles.timelineMethodText}>{formatAttendanceMethod(method)}</Text>
                    </View>
                </View>
            ) : null}
            {byLine ? <Text style={styles.timelineByline}>{byLine}</Text> : null}
        </View>
    );
}

function DetailSection({
    title,
    children,
    styles,
}: {
    title: string;
    children: ReactNode;
    styles: ReturnType<typeof buildStyles>;
}) {
    return (
        <View>
            <Text style={styles.sectionHeading}>{title}</Text>
            <View style={styles.timelineList}>{children}</View>
        </View>
    );
}

function ActivityRow({
    activity,
    styles,
    t,
}: {
    activity: CalendarActivity;
    styles: ReturnType<typeof buildStyles>;
    t: (key: string) => string;
}) {
    const label =
        activity.type === 'PUNCH_IN'
            ? t('home.myCalendar.modal.punchIn')
            : t('home.myCalendar.modal.punchOut');
    const byLine =
        activity.created_by
            ? formatCreatedByLabel(activity.created_by.name, activity.created_by.role)
            : null;

    return (
        <TimelineEntry
            icon={activity.type === 'PUNCH_IN' ? 'login' : 'logout'}
            title={label}
            time={activity.time}
            method={activity.attendance_method}
            byLine={byLine ? `${t('home.myCalendar.modal.createdBy')}: ${byLine}` : null}
            styles={styles}
        />
    );
}

function BreakRow({
    brk,
    styles,
    t,
}: {
    brk: CalendarBreak;
    styles: ReturnType<typeof buildStyles>;
    t: (key: string) => string;
}) {
    const label =
        brk.type === 'BREAK_START'
            ? t('home.myCalendar.modal.breakStart')
            : t('home.myCalendar.modal.breakEnd');
    const byLine =
        brk.created_by
            ? formatCreatedByLabel(brk.created_by.name, brk.created_by.role)
            : null;

    return (
        <TimelineEntry
            icon={brk.type === 'BREAK_START' ? 'coffee-outline' : 'coffee-off-outline'}
            title={label}
            time={brk.time}
            method={brk.attendance_method}
            byLine={byLine ? `${t('home.myCalendar.modal.createdBy')}: ${byLine}` : null}
            styles={styles}
        />
    );
}

function LogRow({
    log,
    styles,
    t,
}: {
    log: CalendarLog;
    styles: ReturnType<typeof buildStyles>;
    t: (key: string) => string;
}) {
    const title =
        log.log_type === 'day_status' && log.day_status
            ? formatStatusLabel(log.day_status)
            : formatLogTypeLabel(log.log_type);
    const byLine =
        log.created_by
            ? formatCreatedByLabel(log.created_by.name, log.created_by.role)
            : null;

    return (
        <TimelineEntry
            icon={log.log_type === 'day_status' ? 'calendar-check-outline' : 'history'}
            title={title}
            time={log.time}
            method={log.attendance_method}
            byLine={byLine ? `${t('home.myCalendar.modal.createdBy')}: ${byLine}` : null}
            styles={styles}
        />
    );
}

function ShiftCard({
    shift,
    styles,
    t,
}: {
    shift: CalendarShift;
    styles: ReturnType<typeof buildStyles>;
    t: (key: string) => string;
}) {
    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('home.myCalendar.shiftTitle')}</Text>
            <View style={styles.shiftRow}>
                <Text style={styles.shiftLabel}>{t('home.myCalendar.shiftStart')}</Text>
                <Text style={styles.shiftValue}>{shift.start_time}</Text>
            </View>
            <View style={styles.shiftRow}>
                <Text style={styles.shiftLabel}>{t('home.myCalendar.shiftEnd')}</Text>
                <Text style={styles.shiftValue}>{shift.end_time}</Text>
            </View>
            <View style={styles.shiftRow}>
                <Text style={styles.shiftLabel}>{t('home.myCalendar.expectedWork')}</Text>
                <Text style={styles.shiftValue}>{formatMinutesToDuration(shift.expected_work_minutes)}</Text>
            </View>
            <View style={styles.shiftRow}>
                <Text style={styles.shiftLabel}>{t('home.myCalendar.expectedBreak')}</Text>
                <Text style={styles.shiftValue}>{formatMinutesToDuration(shift.break_minutes)}</Text>
            </View>
        </View>
    );
}

function DayDetailModal({ visible, dateKey, dayInfo, onClose, styles, t }: DayDetailModalProps) {
    const statusStyle = getStatusStyle(dayInfo?.day_status);
    const hasSummaryDetails = Boolean(
        dayInfo &&
        (
            dayInfo.is_approved != null ||
            dayInfo.is_deductible != null ||
            dayInfo.is_overtime != null ||
            dayInfo.verified_by
        ),
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            statusBarTranslucent
            onRequestClose={onClose}>
            <SafeAreaView style={styles.modalSafe} edges={['top', 'left', 'right', 'bottom']}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('home.myCalendar.modal.close')}
                    style={styles.modalBackdrop}
                    onPress={onClose}
                />
                <View style={styles.modalSheetWrap} pointerEvents="box-none">
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHandle} />
                            {dateKey ? (
                                <Text style={styles.modalTitle} accessibilityRole="header">
                                    {formatDisplayDate(dateKey)}
                                </Text>
                            ) : null}
                            {dayInfo ? (
                                <View
                                    style={[
                                        styles.modalStatusPill,
                                        {
                                            backgroundColor: statusStyle.backgroundColor,
                                            borderColor: statusStyle.borderColor,
                                        },
                                    ]}>
                                    <Text style={[styles.modalStatus, { color: statusStyle.textColor }]}>
                                        {formatStatusLabel(dayInfo.day_status)}
                                    </Text>
                                </View>
                            ) : null}
                        </View>

                        <ScrollView
                            style={styles.modalScroll}
                            contentContainerStyle={styles.modalScrollContent}
                            showsVerticalScrollIndicator
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled
                            bounces={false}>
                            {dayInfo ? (
                                <>
                                    {hasSummaryDetails ? (
                                        <View style={styles.detailSummaryCard}>
                                            {dayInfo.is_approved != null ? (
                                                <DetailRow
                                                    label={t('home.myCalendar.modal.approved')}
                                                    value={
                                                        dayInfo.is_approved
                                                            ? t('home.myCalendar.modal.yes')
                                                            : t('home.myCalendar.modal.no')
                                                    }
                                                    styles={styles}
                                                />
                                            ) : null}

                                            {dayInfo.is_deductible != null ? (
                                                <DetailRow
                                                    label={t('home.myCalendar.modal.deductible')}
                                                    value={
                                                        dayInfo.is_deductible
                                                            ? t('home.myCalendar.modal.yes')
                                                            : t('home.myCalendar.modal.no')
                                                    }
                                                    styles={styles}
                                                />
                                            ) : null}

                                            {dayInfo.is_overtime != null ? (
                                                <DetailRow
                                                    label={t('home.myCalendar.modal.overtime')}
                                                    value={
                                                        dayInfo.is_overtime
                                                            ? t('home.myCalendar.modal.yes')
                                                            : t('home.myCalendar.modal.no')
                                                    }
                                                    styles={styles}
                                                />
                                            ) : null}

                                            {dayInfo.verified_by ? (
                                                <DetailRow
                                                    label={t('home.myCalendar.modal.verifiedBy')}
                                                    value={formatCreatedByLabel(
                                                        dayInfo.verified_by.name,
                                                        dayInfo.verified_by.role,
                                                    )}
                                                    styles={styles}
                                                />
                                            ) : null}
                                        </View>
                                    ) : null}

                                    {dayInfo.activities && dayInfo.activities.length > 0 ? (
                                        <DetailSection title={t('home.myCalendar.modal.activities')} styles={styles}>
                                            {dayInfo.activities.map((activity, i) => (
                                                <ActivityRow
                                                    key={`activity-${i}`}
                                                    activity={activity}
                                                    styles={styles}
                                                    t={t}
                                                />
                                            ))}
                                        </DetailSection>
                                    ) : null}

                                    {dayInfo.breaks && dayInfo.breaks.length > 0 ? (
                                        <DetailSection title={t('home.myCalendar.modal.breaks')} styles={styles}>
                                            {dayInfo.breaks.map((brk, i) => (
                                                <BreakRow
                                                    key={`break-${i}`}
                                                    brk={brk}
                                                    styles={styles}
                                                    t={t}
                                                />
                                            ))}
                                        </DetailSection>
                                    ) : null}

                                    {dayInfo.logs && dayInfo.logs.length > 0 ? (
                                        <DetailSection title={t('home.myCalendar.modal.logs')} styles={styles}>
                                            {dayInfo.logs.map((log, i) => (
                                                <LogRow key={`log-${i}`} log={log} styles={styles} t={t} />
                                            ))}
                                        </DetailSection>
                                    ) : null}

                                    {dayInfo.is_holiday ? (
                                        <View style={styles.detailSummaryCard}>
                                            <Text style={styles.sectionHeading}>
                                                {t('home.myCalendar.modal.holiday')}
                                            </Text>
                                            <DetailRow
                                                label={t('home.myCalendar.modal.name')}
                                                value={dayInfo.is_holiday.name}
                                                styles={styles}
                                            />
                                            <DetailRow
                                                label={t('home.myCalendar.modal.optional')}
                                                value={
                                                    dayInfo.is_holiday.is_optional
                                                        ? t('home.myCalendar.modal.yes')
                                                        : t('home.myCalendar.modal.mandatory')
                                                }
                                                styles={styles}
                                            />
                                        </View>
                                    ) : null}

                                    {dayInfo.is_leave ? (
                                        <View style={styles.detailSummaryCard}>
                                            <Text style={styles.sectionHeading}>
                                                {t('home.myCalendar.modal.leave')}
                                            </Text>
                                            <DetailRow
                                                label={t('home.myCalendar.modal.leaveCode')}
                                                value={dayInfo.is_leave.code}
                                                styles={styles}
                                            />
                                            <DetailRow
                                                label={t('home.myCalendar.modal.leaveName')}
                                                value={dayInfo.is_leave.name}
                                                styles={styles}
                                            />
                                            <DetailRow
                                                label={t('home.myCalendar.modal.leaveType')}
                                                value={formatStatusLabel(dayInfo.is_leave.type)}
                                                styles={styles}
                                            />
                                            {dayInfo.is_leave.half_day_type ? (
                                                <DetailRow
                                                    label={t('home.myCalendar.modal.halfDayType')}
                                                    value={formatStatusLabel(dayInfo.is_leave.half_day_type)}
                                                    styles={styles}
                                                />
                                            ) : null}
                                        </View>
                                    ) : null}
                                </>
                            ) : (
                                <Text style={styles.muted}>{t('home.myCalendar.modal.noData')}</Text>
                            )}
                        </ScrollView>
                        <Pressable
                            accessibilityRole="button"
                            onPress={onClose}
                            style={({ pressed }) => [styles.modalClose, pressed && { opacity: 0.92 }]}>
                            <Text style={styles.modalCloseLabel}>{t('home.myCalendar.modal.close')}</Text>
                        </Pressable>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

function DetailRow({
    label,
    value,
    styles,
}: {
    label: string;
    value: string;
    styles: ReturnType<typeof buildStyles>;
}) {
    return (
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value}</Text>
        </View>
    );
}

function CalendarDayCell({
    cell,
    cellStyles,
    onPress,
}: {
    cell: CalendarGridCell;
    cellStyles: ReturnType<typeof buildStyles>;
    onPress: (dateKey: string, dayInfo: CalendarDayInfo | null) => void;
}) {
    if (cell.day == null || cell.dateKey == null) {
        return <View style={cellStyles.gridCell} />;
    }

    const status = cell.dayInfo?.day_status ?? 'upcoming';
    const visual = getStatusStyle(status);
    const shortStatus = status === 'half_day' ? '½' : status.charAt(0).toUpperCase();
    const pressable = isCalendarDayPressable(status, cell.dayInfo);

    const dayContent = (
        <View
            style={[
                cellStyles.dayCell,
                {
                    backgroundColor: visual.backgroundColor,
                    borderColor: visual.borderColor,
                    opacity: visual.muted ? 0.72 : 1,
                },
            ]}>
            <Text style={[cellStyles.dayNumber, { color: visual.textColor }]}>{cell.day}</Text>
            <Text style={[cellStyles.dayStatus, { color: visual.textColor }]} numberOfLines={1}>
                {shortStatus}
            </Text>
        </View>
    );

    if (!pressable) {
        return (
            <View
                style={cellStyles.gridCell}
                accessibilityRole="text"
                accessibilityLabel={`${cell.day}, ${formatStatusLabel(status)}`}>
                {dayContent}
            </View>
        );
    }

    return (
        <Pressable
            style={cellStyles.gridCell}
            accessibilityRole="button"
            accessibilityLabel={`${cell.day}, ${formatStatusLabel(status)}`}
            onPress={() => onPress(cell.dateKey!, cell.dayInfo)}>
            {dayContent}
        </Pressable>
    );
}

function StatusLegend({ styles }: { styles: ReturnType<typeof buildStyles> }) {
    const items: CalendarDayStatus[] = [
        'present',
        'absent',
        'leave',
        'holiday',
        'weekend',
        'half_day',
        'not_joined',
        'upcoming',
    ];

    return (
        <View style={styles.legendWrap}>
            {items.map(status => {
                const visual = getStatusStyle(status);
                return (
                    <View key={status} style={styles.legendItem}>
                        <View
                            style={[
                                styles.legendSwatch,
                                { backgroundColor: visual.backgroundColor, borderColor: visual.borderColor },
                            ]}
                        />
                        <Text style={styles.legendText}>{formatStatusLabel(status)}</Text>
                    </View>
                );
            })}
        </View>
    );
}

export function MyCalendarScreen({ navigation }: Props) {
    const { t } = useTranslation();
    const colors = useThemeColors();
    const { resolvedScheme } = useAppTheme();
    const { selectedCompany } = useAuth();

    const now = useMemo(() => new Date(), []);
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);

    const [calendarData, setCalendarData] = useState<MyCalendarData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
    const [selectedDayInfo, setSelectedDayInfo] = useState<CalendarDayInfo | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const companyId = selectedCompany?.id ?? null;
    const showSkeleton = loading && !refreshing;

    const styles = useMemo(
        () => buildStyles(colors, resolvedScheme),
        [colors, resolvedScheme],
    );

    const grid = useMemo(
        () => buildCalendarGrid(year, month, calendarData?.days),
        [year, month, calendarData?.days],
    );

    const calendarWeeks = useMemo(() => chunkCalendarWeeks(grid), [grid]);

    const summary = useMemo(
        () => computeCalendarSummary(calendarData?.days),
        [calendarData?.days],
    );

    const load = useCallback(
        async (mode: 'full' | 'refresh' = 'full') => {
            if (companyId == null) {
                setCalendarData(null);
                setError(null);
                setLoading(false);
                setRefreshing(false);
                return;
            }

            if (mode === 'refresh') {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);

            try {
                const res = await fetchMyCalendar({ year, month, companyId });
                if (!res.success || !res.data) {
                    setCalendarData(null);
                    setError(res.message?.trim() || t('home.myCalendar.errors.fetchFailed'));
                    return;
                }
                setCalendarData(res.data);
            } catch (e) {
                setCalendarData(null);
                const message = resolveCalendarFetchError(e, t);
                if (message) {
                    setError(message);
                }
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [companyId, month, t, year],
    );

    useEffect(() => {
        void load('full');
    }, [load]);

    const onRefresh = useCallback(() => {
        void load('refresh');
    }, [load]);

    const goPrevMonth = useCallback(() => {
        const next = shiftMonth(year, month, -1);
        setYear(next.year);
        setMonth(next.month);
    }, [month, year]);

    const goNextMonth = useCallback(() => {
        const next = shiftMonth(year, month, 1);
        setYear(next.year);
        setMonth(next.month);
    }, [month, year]);

    const openDayDetail = useCallback((dateKey: string, dayInfo: CalendarDayInfo | null) => {
        setSelectedDateKey(dateKey);
        setSelectedDayInfo(dayInfo);
        setDetailOpen(true);
    }, []);

    const closeDayDetail = useCallback(() => {
        setDetailOpen(false);
    }, []);

    return (
        <SafeAreaView style={styles.safe} edges={TAB_SCREEN_SAFE_AREA_EDGES}>
            <View style={styles.stackHeader}>
                <HeaderBackButton
                    onPress={() => navigation.goBack()}
                    tintColor={colors.primary}
                    displayMode="minimal"
                    accessibilityLabel={t('home.myCalendar.back')}
                />
                <Text style={styles.stackHeaderTitle} numberOfLines={1} accessibilityRole="header">
                    {t('home.myCalendar.title')}
                </Text>
            </View>

            {companyId == null ? (
                <View style={[styles.centerBox, styles.fill]}>
                    <Text style={styles.muted}>{t('home.myCalendar.noCompany')}</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.fill}
                    contentContainerStyle={styles.scroll}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}>
                    {error ? (
                        <View style={styles.centerBox}>
                            <Text style={styles.error}>{error}</Text>
                            <Pressable
                                accessibilityRole="button"
                                onPress={() => void load('full')}
                                style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.9 }]}>
                                <Text style={styles.retryLabel}>{t('home.myCalendar.retry')}</Text>
                            </Pressable>
                        </View>
                    ) : null}

                    {showSkeleton ? (
                        <CalendarContentSkeleton styles={styles} />
                    ) : (
                        <>
                            <View style={styles.card}>
                                <View style={styles.monthNav}>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={t('home.myCalendar.prevMonth')}
                                        onPress={goPrevMonth}
                                        disabled={loading}
                                        style={({ pressed }) => [
                                            styles.monthNavBtn,
                                            pressed && { opacity: 0.85 },
                                            loading && { opacity: 0.5 },
                                        ]}>
                                        <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
                                    </Pressable>
                                    <Text style={styles.monthNavTitle}>{formatMonthTitle(year, month)}</Text>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={t('home.myCalendar.nextMonth')}
                                        onPress={goNextMonth}
                                        disabled={loading}
                                        style={({ pressed }) => [
                                            styles.monthNavBtn,
                                            pressed && { opacity: 0.85 },
                                            loading && { opacity: 0.5 },
                                        ]}>
                                        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text} />
                                    </Pressable>
                                </View>

                                <View style={styles.weekdayRow}>
                                    {WEEKDAY_LABELS.map(label => (
                                        <View key={label} style={styles.weekdayCol}>
                                            <Text style={styles.weekdayLabel}>{label}</Text>
                                        </View>
                                    ))}
                                </View>

                                {calendarWeeks.map((week, weekIndex) => (
                                    <View
                                        key={`week-${weekIndex}`}
                                        style={[
                                            styles.gridWeekRow,
                                            weekIndex === calendarWeeks.length - 1 && styles.gridWeekRowLast,
                                        ]}>
                                        {week.map((cell, dayIndex) => (
                                            <CalendarDayCell
                                                key={cell.dateKey ?? `empty-${weekIndex}-${dayIndex}`}
                                                cell={cell}
                                                cellStyles={styles}
                                                onPress={openDayDetail}
                                            />
                                        ))}
                                    </View>
                                ))}

                                <StatusLegend styles={styles} />
                            </View>

                            {calendarData?.shift ? (
                                <ShiftCard shift={calendarData.shift} styles={styles} t={t} />
                            ) : null}

                            {calendarData ? (
                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>{t('home.myCalendar.summaryTitle')}</Text>
                                    <View style={styles.summaryGrid}>
                                        {SUMMARY_KEYS.map(item => {
                                            const count = summary[item.key];
                                            const visual: StatusVisualStyle = item.status
                                                ? getStatusStyle(item.status)
                                                : getStatusStyle('upcoming');
                                            return (
                                                <View
                                                    key={item.key}
                                                    style={[
                                                        styles.summaryCard,
                                                        {
                                                            borderColor: visual.borderColor,
                                                            backgroundColor: visual.backgroundColor,
                                                        },
                                                    ]}>
                                                    <Text style={[styles.summaryCount, { color: visual.textColor }]}>
                                                        {count}
                                                    </Text>
                                                    <Text style={styles.summaryLabel}>
                                                        {t(`home.myCalendar.summary.${item.labelKey}`)}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            ) : null}
                        </>
                    )}
                </ScrollView>
            )}

            <DayDetailModal
                visible={detailOpen}
                dateKey={selectedDateKey}
                dayInfo={selectedDayInfo}
                onClose={closeDayDetail}
                styles={styles}
                t={t}
            />
        </SafeAreaView>
    );
}
